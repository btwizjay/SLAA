"use server";
import type postgres from "postgres";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission, type StaffSession } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/staff-permissions";
import { sql } from "@/lib/db";
import { isValidSlaaId } from "@/lib/slaa-id";
import { ageOn } from "@/lib/validation";
import { DISTRICTS } from "@/lib/reference";
import { parseCallback, VERIFICATION_CHECKS } from "@/lib/verification";
import type { ActionState } from "@/lib/admin-ui";
class WorkflowError extends Error {}
const failure = (e: unknown): ActionState => ({
  error:
    e instanceof WorkflowError
      ? e.message
      : "The case could not be saved. Refresh and try again.",
});
const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const reasonSchema = z
  .string()
  .trim()
  .min(5, "Give a reason of at least 5 characters.")
  .max(500);
function identity(data: FormData) {
  const id = value(data, "slaaId").toUpperCase(),
    version = Number(data.get("version"));
  if (!isValidSlaaId(id) || !Number.isSafeInteger(version) || version < 0)
    throw new WorkflowError("Choose a valid case and refresh before saving.");
  return { id, version };
}
async function lockCase(
  tx: postgres.TransactionSql,
  session: StaffSession,
  id: string,
  version: number,
) {
  // The same member-first lock order is used for assignment, calls and review.
  const [m] =
    await tx`SELECT date_of_birth::text dob,status,phone FROM member WHERE slaa_id=${id} FOR UPDATE`;
  const [v] =
    await tx`SELECT * FROM member_verification WHERE slaa_id=${id} FOR UPDATE`;
  if (
    !m ||
    !v ||
    !["pending", "verified"].includes(m.status) ||
    (!hasPermission(session.role, "manage_verification") &&
      v.assignee_id !== session.id)
  )
    throw new WorkflowError(
      "This case is unavailable or is not assigned to you.",
    );
  if (Number(v.version) !== version)
    throw new WorkflowError(
      "This case changed. Refresh and check its call history before saving again.",
    );
  return {
    ...v,
    status: String(v.status),
    dob: String(m.dob),
    member_status: m.status,
    phone: m.phone,
  };
}
export async function assignVerification(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const actor = await requirePermission("manage_verification");
  const target = value(data, "assigneeId"),
    reason = reasonSchema.safeParse(value(data, "reason"));
  if (!z.uuid().safeParse(target).success || !reason.success)
    return {
      error: reason.success
        ? "Choose a staff member."
        : reason.error.issues[0].message,
    };
  let count = 0;
  try {
    await sql.begin(async (tx) => {
      const [staff] =
        await tx`SELECT id FROM admin_staff WHERE id=${target} AND active FOR SHARE`;
      if (!staff) throw new WorkflowError("Choose an active staff member.");
      if (data.get("mode") === "next") {
        const limit = Number(data.get("count")),
          district = value(data, "district");
        if (
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 100 ||
          (district && !(DISTRICTS as readonly string[]).includes(district))
        )
          throw new WorkflowError(
            "Choose 1–100 applicants and a valid district.",
          );
        const members =
          await tx`SELECT m.slaa_id FROM member m JOIN athlete a USING(slaa_id) WHERE m.status='pending'
          AND NOT EXISTS(SELECT 1 FROM member_verification v WHERE v.slaa_id=m.slaa_id)
          ${district ? tx`AND m.district=${district}` : tx``}
          ORDER BY m.created_at,m.slaa_id LIMIT ${limit} FOR UPDATE OF m SKIP LOCKED`;
        if (!members.length)
          throw new WorkflowError(
            "No unassigned applicants match this selection.",
          );
        const records = members.map((m) => ({
          slaa_id: m.slaa_id,
          assignee_id: target,
          assigned_by: actor.email,
        }));
        const inserted =
          await tx`INSERT INTO member_verification ${tx(records, "slaa_id", "assignee_id", "assigned_by")} ON CONFLICT(slaa_id) DO NOTHING RETURNING slaa_id`;
        count = inserted.length;
        if (!count)
          throw new WorkflowError(
            "These applicants were just assigned by another supervisor. Refresh and try again.",
          );
        await tx`INSERT INTO audit_log(actor,action,slaa_id,details) SELECT ${actor.email},'verification_assigned',slaa_id,
          jsonb_build_object('assignee_id',${target}::text,'reason',${reason.data}::text) FROM member_verification WHERE slaa_id=ANY(${inserted.map((r) => r.slaa_id)}::text[])`;
      } else {
        const { id, version } = identity(data);
        const [m] =
          await tx`SELECT status FROM member m JOIN athlete a USING(slaa_id) WHERE m.slaa_id=${id} FOR UPDATE OF m`;
        const [v] =
          await tx`SELECT * FROM member_verification WHERE slaa_id=${id} FOR UPDATE`;
        if (
          !m ||
          !["pending", "verified"].includes(m.status) ||
          (!v && m.status !== "pending")
        )
          throw new WorkflowError("Choose an applicant awaiting verification.");
        if ((v?.version ?? 0) !== version)
          throw new WorkflowError(
            "This case changed. Refresh before assigning it.",
          );
        if (v && ["approved", "rejected"].includes(v.status))
          throw new WorkflowError("Reopen the case before assigning it again.");
        await tx`INSERT INTO member_verification(slaa_id,assignee_id,assigned_by) VALUES(${id},${target},${actor.email})
          ON CONFLICT(slaa_id) DO UPDATE SET assignee_id=excluded.assignee_id,assigned_by=excluded.assigned_by,
          assigned_at=now(),version=member_verification.version+1,updated_at=now()`;
        await tx`INSERT INTO audit_log(actor,action,slaa_id,details) VALUES(${actor.email},'verification_assigned',${id},${tx.json({ assignee_id: target, previous_assignee_id: v?.assignee_id ?? null, reason: reason.data })})`;
        count = 1;
      }
    });
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/admin", "layout");
  return { success: `Assigned ${count} applicant${count === 1 ? "" : "s"}.` };
}
export async function recordVerificationCall(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const actor = await requirePermission("verify_applicants");
  const parsed = z
    .object({
      outcome: z.enum([
        "confirmed",
        "no_answer",
        "busy",
        "callback",
        "wrong_number",
        "mismatch",
        "declined",
      ]),
      notes: z
        .string()
        .trim()
        .min(5, "Record call notes of at least 5 characters.")
        .max(2000),
      respondent: z.enum(["applicant", "guardian", "not_reached"]),
    })
    .safeParse({
      outcome: data.get("outcome"),
      notes: value(data, "notes"),
      respondent: data.get("respondent"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const p = parsed.data,
    approve = data.get("approve") === "on";
  if (p.outcome === "confirmed" && p.respondent === "not_reached")
    return {
      error:
        "Choose the applicant or guardian you spoke with before recording confirmed information.",
    };
  const checks = Object.fromEntries(
    Object.keys(VERIFICATION_CHECKS).map((k) => [k, data.get(k) === "on"]),
  );
  let followup: Date | null;
  try {
    followup = parseCallback(value(data, "followUpAt"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (p.outcome === "callback" && !followup)
    return { error: "Set a future callback date and time." };
  if (
    approve &&
    (p.outcome !== "confirmed" ||
      p.respondent === "not_reached" ||
      !Object.values(checks).every(Boolean))
  )
    return {
      error:
        "Final approval requires a confirmed conversation and every verification check.",
    };
  try {
    const { id, version } = identity(data);
    await sql.begin(async (tx) => {
      const v = await lockCase(tx, actor, id, version);
      if (["approved", "rejected"].includes(v.status))
        throw new WorkflowError(
          "This case is closed. A supervisor must reopen it before another call is recorded.",
        );
      if (approve && ageOn(v.dob) < 18) {
        const [g] =
          await tx`SELECT 1 FROM guardian WHERE athlete_id=${id} AND phone IS NOT NULL AND phone<>'' LIMIT 1`;
        if (!g || p.respondent !== "guardian")
          throw new WorkflowError(
            "For a minor, speak with the recorded guardian before giving final approval.",
          );
      }
      if (approve && ageOn(v.dob) >= 18 && !v.phone)
        throw new WorkflowError(
          "An administrator must record a contact number before final approval.",
        );
      const status = approve
        ? "approved"
        : ["wrong_number", "mismatch", "declined"].includes(p.outcome)
          ? "needs_review"
          : followup
            ? "callback"
            : "in_progress";
      const next = status === "callback" ? followup : null;
      const [contact] =
        await tx`INSERT INTO verification_contact(slaa_id,actor,outcome,notes,checks,follow_up_at,approved)
        VALUES(${id},${actor.email},${p.outcome},${p.notes},${tx.json({ ...checks, respondent_type: p.respondent })},${next},${approve}) RETURNING id`;
      if (approve) {
        const changed =
          await tx`UPDATE member SET status='verified' WHERE slaa_id=${id} AND status='pending' RETURNING slaa_id`;
        if (!changed.length)
          throw new WorkflowError(
            "This applicant is already verified. Refresh to see the latest status.",
          );
      }
      await tx`UPDATE member_verification SET status=${status},follow_up_at=${next},
        verified_by=${approve ? actor.email : null},verified_at=${approve ? new Date() : null},version=version+1,updated_at=now() WHERE slaa_id=${id}`;
      await tx`INSERT INTO audit_log(actor,action,slaa_id,details) VALUES(${actor.email},${approve ? "verification_approved" : "verification_call"},${id},
        ${tx.json({ contact_id: contact.id, outcome: p.outcome, status, role: actor.role })})`;
    });
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/admin", "layout");
  return {
    success: approve
      ? "Call saved. Applicant verified."
      : "Call saved and follow-up status updated.",
  };
}
export async function reviewVerification(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const actor = await requirePermission("manage_verification");
  const decision = value(data, "decision"),
    reason = reasonSchema.safeParse(value(data, "reason"));
  if (!["reopen", "reject"].includes(decision) || !reason.success)
    return {
      error: "Choose a review action and give a reason of 5–500 characters.",
    };
  try {
    const { id, version } = identity(data);
    await sql.begin(async (tx) => {
      const v = await lockCase(tx, actor, id, version);
      if (decision === "reject" && v.status === "approved")
        throw new WorkflowError(
          "Reopen an approved case before closing it without approval.",
        );
      if (decision === "reopen" && v.status === "approved")
        await tx`UPDATE member SET status='pending' WHERE slaa_id=${id} AND status='verified'`;
      await tx`UPDATE member_verification SET status=${decision === "reopen" ? "assigned" : "rejected"},follow_up_at=NULL,verified_by=NULL,verified_at=NULL,version=version+1,updated_at=now() WHERE slaa_id=${id}`;
      await tx`INSERT INTO audit_log(actor,action,slaa_id,details) VALUES(${actor.email},${"verification_" + decision},${id},${tx.json({ reason: reason.data, previous_status: v.status })})`;
    });
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/admin", "layout");
  return {
    success:
      decision === "reopen"
        ? "Case reopened; previous call history is preserved."
        : "Case closed without approval. The registration has not been deleted.",
  };
}
