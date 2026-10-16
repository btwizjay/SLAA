"use server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { parseNic } from "@/lib/nic";
import { mapPgError } from "@/lib/errors";
import { editProfileSchema, coachCreateSchema } from "@/lib/admin-validation";
import { isValidSlaaId } from "@/lib/slaa-id";
import {
  ageOn,
  cleanText,
  coachLinkSchema,
  normalizeIdentity,
  normalizePhone,
} from "@/lib/validation";
import type { ActionState } from "@/lib/admin-ui";
class StaffError extends Error {}
function failure(error: unknown): ActionState {
  return {
    error:
      error instanceof StaffError
        ? error.message
        : (mapPgError(error)?.message ??
          "The change could not be saved. Please try again."),
  };
}
function personInput(data: FormData) {
  const value = (k: string) => String(data.get(k) ?? "").trim();
  const nic = value("nic");
  const parsed = parseNic(nic);
  return {
    fullName: value("fullName"),
    nameWithInitials: value("nameWithInitials"),
    dateOfBirth:
      value("identityType") === "nic" && parsed.ok
        ? parsed.info.dateOfBirth
        : value("dateOfBirth"),
    gender:
      value("identityType") === "nic" && parsed.ok
        ? parsed.info.gender
        : value("gender"),
    district: value("district"),
    phone: value("phone"),
    email: value("email"),
    identity:
      value("identityType") === "postal"
        ? { type: "postal", postalId: value("postalId") }
        : { type: "nic", nic },
    licenseNo: value("licenseNo"),
    licenseLevel: value("licenseLevel"),
    disciplines: data.getAll("disciplines").map(String),
    reason: value("reason"),
  };
}
export async function editProfile(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const id = String(data.get("slaaId") ?? "");
  if (!isValidSlaaId(id)) return { error: "Invalid member ID." };
  let events: unknown;
  try {
    events = JSON.parse(String(data.get("events") ?? "[]"));
  } catch {
    return { error: "Please check the event entries." };
  }
  const guardianName = String(data.get("guardianName") ?? "").trim();
  const parsed = editProfileSchema.safeParse({
    ...personInput(data),
    schoolOrClub: String(data.get("schoolOrClub") ?? ""),
    events,
    guardian: guardianName
      ? {
          fullName: guardianName,
          relationship: String(data.get("guardianRelationship") ?? ""),
          phone: String(data.get("guardianPhone") ?? ""),
          nic: String(data.get("guardianNic") ?? ""),
          consent: data.get("guardianConsent") === "on",
        }
      : null,
  });
  if (!parsed.success)
    return {
      error: parsed.error.issues
        .map((i) => i.message)
        .slice(0, 3)
        .join(" "),
    };
  const p = parsed.data,
    idValue = normalizeIdentity(p.identity);
  if (new Set(p.events.map((e) => e.code)).size !== p.events.length)
    return { error: "Each event can be listed once." };
  try {
    await sql.begin(async (tx) => {
      const [current] =
        await tx`SELECT m.status,m.updated_at::text version,a.slaa_id IS NOT NULL athlete,c.slaa_id IS NOT NULL coach
        FROM member m LEFT JOIN athlete a USING(slaa_id) LEFT JOIN coach c USING(slaa_id) WHERE m.slaa_id=${id} FOR UPDATE OF m`;
      if (!current || current.status === "merged")
        throw new StaffError(
          "This member no longer exists or has been merged.",
        );
      if (current.version !== String(data.get("version") ?? ""))
        throw new StaffError(
          "Another staff member changed this record. Refresh before saving your corrections.",
        );
      if (current.athlete && !p.events.length)
        throw new StaffError("An athlete needs at least one event.");
      if (current.athlete && ageOn(p.dateOfBirth) < 18 && !p.guardian)
        throw new StaffError(
          "A minor must have guardian details and authorization.",
        );
      await tx`UPDATE member SET full_name=${cleanText(p.fullName)},name_with_initials=${cleanText(p.nameWithInitials)},
        nic=${idValue.nic},nic_as_entered=${p.identity.type === "nic" ? p.identity.nic : null},postal_id=${idValue.postalId},
        date_of_birth=${p.dateOfBirth},gender=${p.gender},district=${p.district},phone=${p.phone ? normalizePhone(p.phone) : null},email=${p.email || null} WHERE slaa_id=${id}`;
      if (current.athlete) {
        await tx`UPDATE athlete SET school_or_club=${cleanText(p.schoolOrClub) || null} WHERE slaa_id=${id}`;
        await tx`SELECT admin_replace_events(${id},${tx.json(p.events)},${actor},${p.reason})`;
        if (p.guardian) {
          const g = p.guardian;
          const [existing] =
            await tx`SELECT id FROM guardian WHERE athlete_id=${id} ORDER BY id LIMIT 1`;
          if (existing)
            await tx`UPDATE guardian SET full_name=${cleanText(g.fullName)},relationship=${cleanText(g.relationship)},phone=${normalizePhone(g.phone)},nic=${g.nic || null} WHERE id=${existing.id}`;
          else
            await tx`INSERT INTO guardian(athlete_id,full_name,relationship,phone,nic,consent_given_at) VALUES(${id},${cleanText(g.fullName)},${g.relationship},${normalizePhone(g.phone)},${g.nic || null},now())`;
        }
      }
      if (current.coach)
        await tx`UPDATE coach SET slaa_license_no=${p.licenseNo || null},license_level=${p.licenseLevel || null},disciplines=${[...new Set(p.disciplines)]} WHERE slaa_id=${id}`;
      await tx`INSERT INTO audit_log(actor,action,slaa_id,details) VALUES(${actor},'edit_profile',${id},${tx.json({ reason: p.reason })})`;
    });
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/admin", "layout");
  return {
    success:
      "Member details saved. The SLAA ID and original consent record are preserved.",
  };
}
export async function createCoach(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = coachCreateSchema.safeParse({
    ...personInput(data),
    consent: data.get("consent") === "on",
  });
  if (!parsed.success)
    return {
      error: parsed.error.issues
        .map((i) => i.message)
        .slice(0, 3)
        .join(" "),
    };
  const p = parsed.data,
    id = normalizeIdentity(p.identity);
  let coachId = "";
  try {
    await sql.begin(async (tx) => {
      const [existing] =
        await tx`SELECT m.slaa_id,m.status,c.slaa_id IS NOT NULL coach FROM member m LEFT JOIN coach c USING(slaa_id)
      WHERE m.status <> 'merged' AND ((${id.nic}::text IS NOT NULL AND m.nic=${id.nic}) OR (${id.postalId}::text IS NOT NULL AND m.postal_id=${id.postalId})) FOR UPDATE OF m`;
      if (existing) {
        if (existing.status === "suspended")
          throw new StaffError(
            "This member is suspended. Review their profile before adding a coach role.",
          );
        if (existing.coach)
          throw new StaffError(
            `This person is already a coach: ${existing.slaa_id}.`,
          );
        if (data.get("linkExisting") !== "on")
          throw new StaffError(
            `This identity belongs to ${existing.slaa_id}. Confirm adding the coach role to that existing member.`,
          );
        coachId = existing.slaa_id;
      } else {
        const [member] =
          await tx`INSERT INTO member(slaa_id,nic_as_entered,postal_id,full_name,name_with_initials,date_of_birth,gender,district,phone,email,consent_version,consent_at)
        VALUES(new_slaa_id('C'),${p.identity.type === "nic" ? p.identity.nic : null},${id.postalId},${cleanText(p.fullName)},${cleanText(p.nameWithInitials)},${p.dateOfBirth},${p.gender},${p.district},${p.phone ? normalizePhone(p.phone) : null},${p.email || null},'staff-recorded-v1',now()) RETURNING slaa_id`;
        coachId = member.slaa_id;
      }
      await tx`INSERT INTO coach(slaa_id,slaa_license_no,license_level,disciplines) VALUES(${coachId},${p.licenseNo || null},${p.licenseLevel || null},${[...new Set(p.disciplines)]})`;
      await tx`INSERT INTO audit_log(actor,action,slaa_id,details) VALUES(${actor},'create_coach',${coachId},${tx.json({ reason: p.reason, existing_member: !!existing })})`;
    });
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/admin", "layout");
  return { success: `Coach profile ready: ${coachId}.` };
}
export async function reviewLink(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const id = Number(data.get("linkId")),
    decision = String(data.get("decision") ?? ""),
    reason = String(data.get("reason") ?? "").trim();
  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    !["approved", "rejected", "pending"].includes(decision) ||
    !reason ||
    reason.length > 500
  )
    return {
      error: "Choose a decision and give a reason (up to 500 characters).",
    };
  try {
    await sql.begin(async (tx) => {
      const [link] =
        await tx`SELECT ac.athlete_id,ac.coach_id FROM athlete_coach ac JOIN member a ON a.slaa_id=ac.athlete_id JOIN member c ON c.slaa_id=ac.coach_id
      WHERE ac.id=${id} AND a.status NOT IN ('merged','suspended') AND c.status NOT IN ('merged','suspended') FOR UPDATE OF ac`;
      if (!link)
        throw new StaffError(
          "This relationship is unavailable or belongs to a merged or suspended member.",
        );
      await tx`UPDATE athlete_coach SET review_status=${decision},is_approved_by_coach=${decision === "approved"},is_primary=CASE WHEN ${decision === "rejected"} THEN false ELSE is_primary END,reviewed_by=${actor},reviewed_at=now(),review_reason=${reason} WHERE id=${id}`;
      await tx`INSERT INTO audit_log(actor,action,slaa_id,details) VALUES(${actor},'review_coach_link',${link.athlete_id},${tx.json({ link_id: id, coach: link.coach_id, decision, reason })})`;
    });
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/admin", "layout");
  return { success: "Coach relationship review saved." };
}
export async function saveCoachLink(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin(),
    athleteId = String(data.get("athleteId") ?? ""),
    reason = String(data.get("reason") ?? "").trim();
  const linkId = Number(data.get("linkId") ?? 0);
  const parsed = coachLinkSchema.safeParse({
    coachId: String(data.get("coachId") ?? "")
      .trim()
      .toUpperCase(),
    relationship: data.get("relationship"),
    startYear: String(data.get("startYear") ?? ""),
    endYear: String(data.get("endYear") ?? ""),
    isPrimary: data.get("isPrimary") === "on",
  });
  if (
    !isValidSlaaId(athleteId) ||
    !parsed.success ||
    !reason ||
    reason.length > 500 ||
    !Number.isSafeInteger(linkId) ||
    linkId < 0
  )
    return {
      error: parsed.success
        ? "Give a valid relationship and reason."
        : parsed.error.issues.map((i) => i.message).join(" "),
    };
  const p = parsed.data;
  if (athleteId === p.coachId)
    return { error: "A member cannot coach themselves." };
  try {
    await sql.begin(async (tx) => {
      const [athlete] =
        await tx`SELECT m.slaa_id FROM member m JOIN athlete a USING(slaa_id) WHERE m.slaa_id=${athleteId} AND m.status IN ('pending','verified') FOR UPDATE OF m`;
      const [coach] =
        await tx`SELECT m.slaa_id FROM member m JOIN coach c USING(slaa_id) WHERE m.slaa_id=${p.coachId} AND m.status IN ('pending','verified')`;
      if (!athlete || !coach)
        throw new StaffError("Choose an active athlete and coach.");
      if (linkId) {
        const [existing] =
          await tx`SELECT id FROM athlete_coach WHERE id=${linkId} AND athlete_id=${athleteId} FOR UPDATE`;
        if (!existing)
          throw new StaffError("This relationship is no longer available.");
      }
      if (p.isPrimary)
        await tx`UPDATE athlete_coach SET is_primary=false WHERE athlete_id=${athleteId} AND is_primary`;
      if (linkId)
        await tx`UPDATE athlete_coach SET coach_id=${p.coachId},relationship_type=${p.relationship},is_primary=${p.isPrimary},start_year=${p.startYear || null},end_year=${p.endYear || null},review_status='pending',is_approved_by_coach=false,reviewed_at=NULL,reviewed_by=NULL,review_reason=NULL WHERE id=${linkId}`;
      else
        await tx`INSERT INTO athlete_coach(athlete_id,coach_id,relationship_type,is_primary,start_year,end_year) VALUES(${athleteId},${p.coachId},${p.relationship},${p.isPrimary},${p.startYear || null},${p.endYear || null})`;
      await tx`INSERT INTO audit_log(actor,action,slaa_id,details) VALUES(${actor},'edit_coach_link',${athleteId},${tx.json({ reason, coach: p.coachId, link_id: linkId || null })})`;
    });
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/admin", "layout");
  return { success: "Relationship saved and queued for coach review." };
}
