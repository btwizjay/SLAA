import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/staff-permissions";
import {
  getVerificationCase,
  verificationStaff,
} from "@/lib/verification-data";
import { sql } from "@/lib/db";
import { ageOn } from "@/lib/validation";
import {
  CASE_LABELS,
  CALL_OUTCOMES,
  VERIFICATION_CHECKS,
  sriLankaTime,
} from "@/lib/verification";
import { ActionForm } from "@/components/admin/ActionForm";
import {
  assignVerification,
  recordVerificationCall,
  reviewVerification,
} from "../actions";
export const metadata = { title: "Applicant verification · SLAA" };
export default async function VerificationCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("verify_applicants"),
    manager = hasPermission(session.role, "manage_verification");
  const { id: raw } = await params,
    id = raw.toUpperCase();
  const m = await getVerificationCase(id);
  if (!m) notFound();
  const [contacts, events, coaches, staff] = await Promise.all([
    sql`SELECT actor,outcome,notes,checks,follow_up_at,approved,created_at FROM verification_contact WHERE slaa_id=${id} ORDER BY created_at DESC,id DESC LIMIT 50`,
    sql`SELECT event_code,personal_best,pb_year,pb_competition FROM athlete_event WHERE athlete_id=${id} ORDER BY rank`,
    sql`SELECT cm.full_name,ac.relationship_type,ac.is_primary FROM athlete_coach ac JOIN member cm ON cm.slaa_id=ac.coach_id WHERE ac.athlete_id=${id} ORDER BY ac.relationship_type,ac.id`,
    manager ? verificationStaff() : Promise.resolve([]),
  ]);
  const minor = ageOn(m.dob) < 18,
    closed = ["approved", "rejected"].includes(m.case_status);
  const phone = minor ? m.guardian_phone : m.phone;
  const hidden = (
    <>
      <input type="hidden" name="slaaId" value={id} />
      <input type="hidden" name="version" value={m.version} />
    </>
  );
  const control = "mt-1 h-11 w-full rounded-lg border bg-background px-3";
  return (
    <div className="space-y-6">
      <Link href="/admin/verification" className="text-sm text-primary">
        ← Verification & calls
      </Link>
      <div>
        <p className="font-mono text-sm">{id}</p>
        <h1 className="mt-1 text-2xl font-bold">{m.full_name}</h1>
        <p className="mt-2 text-sm">
          {CASE_LABELS[m.case_status]} · Assigned to{" "}
          {m.assignee_name ?? m.assignee_email ?? "nobody yet"}
        </p>
        {m.verified_by && (
          <p className="mt-1 text-sm text-emerald-700">
            Verified by {m.verified_by} on {sriLankaTime(m.verified_at)}
          </p>
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border bg-background p-5">
          <h2 className="font-semibold">Applicant information</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {[
              ["Identity", m.identity_hint],
              ["Date of birth", m.dob],
              ["Gender", m.gender === "F" ? "Female" : "Male"],
              ["District", m.district],
              ["Mobile number", m.phone],
              ["Email", m.email],
              ["School / club", m.school_or_club],
            ].map(([label, val]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-words">{val || "Not provided"}</dd>
              </div>
            ))}
          </dl>
          {hasPermission(session.role, "manage_register") && (
            <Link
              href={`/admin/members/${id}`}
              className="inline-block text-sm text-primary underline"
            >
              Open full member record for corrections
            </Link>
          )}
        </section>
        <section className="space-y-3 rounded-xl border bg-background p-5">
          <h2 className="font-semibold">Call contact</h2>
          {minor ? (
            <>
              <p className="text-sm font-medium">
                This applicant is under 18. Speak with their recorded guardian
                before approval.
              </p>
              <p className="text-sm">
                {m.guardian_name ?? "Guardian missing"}
                {m.guardian_relationship ? ` · ${m.guardian_relationship}` : ""}
              </p>
            </>
          ) : (
            <p className="text-sm">
              Call the applicant to confirm their registration.
            </p>
          )}
          {phone ? (
            <a
              href={`tel:${String(phone).replace(/[^\d+]/g, "")}`}
              className="inline-block rounded-lg bg-primary px-4 py-3 font-medium text-white"
            >
              Call {phone}
            </a>
          ) : (
            <p
              role="alert"
              className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
            >
              No usable {minor ? "guardian " : ""}phone number is recorded. Ask
              an administrator to correct the contact details.
            </p>
          )}
          <p className="text-sm">
            Next callback: {sriLankaTime(m.follow_up_at)}
          </p>
        </section>
      </div>
      <section className="rounded-xl border bg-background p-5">
        <h2 className="mb-3 font-semibold">Athletics information to confirm</h2>
        <ul className="space-y-1 text-sm">
          {events.map((e) => (
            <li key={e.event_code}>
              {e.event_code}
              {e.personal_best ? ` · PB ${e.personal_best}` : ""}
              {e.pb_year ? ` (${e.pb_year})` : ""}
              {e.pb_competition ? ` · ${e.pb_competition}` : ""}
            </li>
          ))}
          {!events.length && <li>No events recorded.</li>}
        </ul>
        <h3 className="mb-2 mt-4 text-sm font-medium">Coaches</h3>
        <ul className="space-y-1 text-sm">
          {coaches.map((c, i) => (
            <li key={i}>
              {c.full_name} ·{" "}
              {c.relationship_type === "CURRENT" ? "Current" : "Past"}
              {c.is_primary ? " · Primary" : ""}
            </li>
          ))}
          {!coaches.length && <li>No registered coach linked.</li>}
        </ul>
      </section>
      {!!m.assignee_id && !closed && (
        <section className="max-w-2xl rounded-xl border bg-background p-5">
          <h2 className="mb-4 text-lg font-semibold">
            Record verification call
          </h2>
          <ActionForm
            action={recordVerificationCall}
            submit="Save call outcome"
          >
            {hidden}
            <label className="text-sm">
              Call outcome
              <select name="outcome" required className={control}>
                <option value="">Choose outcome</option>
                {Object.entries(CALL_OUTCOMES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Who did you speak with?
              <select name="respondent" required className={control}>
                <option value="not_reached">Nobody reached</option>
                <option value="applicant">Applicant</option>
                <option value="guardian">Recorded guardian</option>
              </select>
            </label>
            <label className="text-sm">
              Call notes
              <textarea
                name="notes"
                minLength={5}
                maxLength={2000}
                required
                rows={4}
                className="mt-1 w-full rounded-lg border p-3"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Record what you checked and what needs follow-up. Do not enter
              full identity numbers.
            </p>
            <label className="text-sm">
              Callback date and time (Sri Lanka time)
              <input
                name="followUpAt"
                type="datetime-local"
                className={control}
              />
            </label>
            <fieldset className="space-y-3 rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">
                Checks for final approval
              </legend>
              {Object.entries(VERIFICATION_CHECKS).map(([k, label]) => (
                <label key={k} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name={k} className="mt-1" />
                  {label}
                </label>
              ))}
            </fieldset>
            <label className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium">
              <input type="checkbox" name="approve" className="mt-1" />
              Give final approval and mark this applicant verified
            </label>
          </ActionForm>
        </section>
      )}
      {manager && (
        <div className="grid gap-5 lg:grid-cols-2">
          {!closed && (
            <section className="rounded-xl border bg-background p-5">
              <h2 className="mb-4 font-semibold">
                Assign or reassign applicant
              </h2>
              <ActionForm action={assignVerification} submit="Save assignment">
                {hidden}
                <input type="hidden" name="mode" value="single" />
                <label className="text-sm">
                  Assign to
                  <select
                    name="assigneeId"
                    defaultValue={m.assignee_id ?? ""}
                    required
                    className={control}
                  >
                    <option value="">Choose a staff member</option>
                    {staff.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.display_name ?? u.email}
                        {u.organization ? ` · ${u.organization}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Assignment reason
                  <input
                    name="reason"
                    minLength={5}
                    maxLength={500}
                    required
                    className={control}
                  />
                </label>
              </ActionForm>
            </section>
          )}
          {!!m.assignee_id && (
            <section className="rounded-xl border bg-background p-5">
              <h2 className="mb-4 font-semibold">Supervisor review</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Reopening a verified case returns the registration to pending
                and keeps its call history. Closing without approval keeps the
                registration for review.
              </p>
              <ActionForm action={reviewVerification} submit="Save review">
                {hidden}
                <label className="text-sm">
                  Review action
                  <select name="decision" className={control}>
                    <option value="reopen">Reopen for verification</option>
                    {m.case_status !== "approved" && (
                      <option value="reject">Close without approval</option>
                    )}
                  </select>
                </label>
                <label className="text-sm">
                  Review reason
                  <textarea
                    name="reason"
                    minLength={5}
                    maxLength={500}
                    rows={2}
                    required
                    className="mt-1 w-full rounded-lg border p-3"
                  />
                </label>
              </ActionForm>
            </section>
          )}
        </div>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Call history</h2>
        <p className="text-sm text-muted-foreground">
          Most recent 50 calls. All times use Sri Lanka time.
        </p>
        {contacts.map((c, i) => (
          <article
            key={i}
            className="space-y-2 rounded-xl border bg-background p-4 text-sm"
          >
            <p className="font-medium">
              {CALL_OUTCOMES[c.outcome as keyof typeof CALL_OUTCOMES]}
              {c.approved ? " · Final approval recorded" : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {sriLankaTime(c.created_at)} · {c.actor}
            </p>
            <p className="whitespace-pre-wrap">{c.notes}</p>
            {c.follow_up_at && <p>Callback: {sriLankaTime(c.follow_up_at)}</p>}
          </article>
        ))}
        {!contacts.length && (
          <p className="text-sm text-muted-foreground">
            No calls recorded yet.
          </p>
        )}
      </section>
    </div>
  );
}
