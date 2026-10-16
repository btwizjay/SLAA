import Link from "next/link";
import { requirePermission } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/staff-permissions";
import { sql } from "@/lib/db";
import { verificationScope, verificationStaff } from "@/lib/verification-data";
import { CASE_LABELS, sriLankaTime } from "@/lib/verification";
import { DISTRICTS } from "@/lib/reference";
import { ActionForm } from "@/components/admin/ActionForm";
import { assignVerification } from "./actions";
export const metadata = { title: "Verification & calls · SLAA" };
export default async function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePermission("verify_applicants"),
    manager = hasPermission(session.role, "manage_verification");
  const s = await searchParams;
  const status =
    s.status && Object.hasOwn(CASE_LABELS, s.status) ? s.status : "";
  const q = (s.q ?? "").trim().slice(0, 120),
    due = s.due === "1";
  const assignee =
    manager &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      s.assignee ?? "",
    )
      ? String(s.assignee)
      : "";
  const page = Math.min(100000, Math.max(1, parseInt(s.page ?? "1", 10) || 1));
  const base = sql`WHERE m.status IN ('pending','verified') AND (m.status='pending' OR v.slaa_id IS NOT NULL) ${verificationScope(session)}`;
  const pattern = "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
  const where = sql`${base} ${status ? sql`AND coalesce(v.status,'unassigned')=${status}` : sql``}
    ${q ? sql`AND (m.full_name ILIKE ${pattern} OR m.slaa_id ILIKE ${pattern})` : sql``}
    ${due ? sql`AND v.follow_up_at<=now() AND v.status NOT IN ('approved','rejected')` : sql``}
    ${assignee ? sql`AND v.assignee_id=${assignee}::uuid` : sql``}`;
  const [rows, [{ total }], counts, staff] = await Promise.all([
    sql`SELECT m.slaa_id,m.full_name,m.district,m.status member_status,coalesce(v.status,'unassigned') case_status,
      v.follow_up_at,coalesce(u.display_name,u.email) assignee,
      (SELECT count(*)::int FROM verification_contact c WHERE c.slaa_id=m.slaa_id) calls
      FROM member m JOIN athlete a USING(slaa_id) LEFT JOIN member_verification v USING(slaa_id)
      LEFT JOIN admin_staff u ON u.id=v.assignee_id ${where}
      ORDER BY (v.follow_up_at<=now() AND v.status NOT IN ('approved','rejected')) DESC NULLS LAST,m.created_at,m.slaa_id LIMIT 50 OFFSET ${(page - 1) * 50}`,
    sql`SELECT count(*)::int total FROM member m JOIN athlete a USING(slaa_id) LEFT JOIN member_verification v USING(slaa_id) ${where}`,
    sql`SELECT coalesce(v.status,'unassigned') status,count(*)::int total FROM member m JOIN athlete a USING(slaa_id) LEFT JOIN member_verification v USING(slaa_id) ${base} GROUP BY coalesce(v.status,'unassigned')`,
    manager ? verificationStaff() : Promise.resolve([]),
  ]);
  const qs = (patch: Record<string, string>) =>
    "?" +
    new URLSearchParams({
      ...Object.fromEntries(
        Object.entries({ status, q, due: due ? "1" : "", assignee }).filter(
          ([, v]) => v,
        ),
      ),
      ...patch,
    });
  const control =
    "mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Verification & calls</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {manager
            ? "Assign applicants, track calls and callbacks, and review cases needing attention."
            : "Your assigned applicants. Call the applicant or guardian, record the outcome, and approve only after every check is complete."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {counts.map((c) => (
          <Link
            key={c.status}
            href={qs({ status: c.status, page: "1", due: "" })}
            className="rounded-xl border bg-background p-4"
          >
            <span className="text-sm">{CASE_LABELS[c.status]}</span>
            <strong className="mt-2 block text-2xl">{c.total}</strong>
          </Link>
        ))}
      </div>
      {manager && (
        <details className="rounded-xl border bg-background p-5">
          <summary className="cursor-pointer font-semibold">
            Assign the next applicants
          </summary>
          <p className="my-3 text-sm text-muted-foreground">
            Assign up to 100 unassigned applicants at once, oldest first.
            Existing call histories and assignments are preserved.
          </p>
          <ActionForm
            action={assignVerification}
            submit="Assign applicants"
            className="max-w-lg"
          >
            <input type="hidden" name="mode" value="next" />
            <label className="text-sm">
              Assign to
              <select name="assigneeId" required className={control}>
                <option value="">Choose a staff member</option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name ?? u.email}
                    {u.organization ? ` · ${u.organization}` : ""} ({u.assigned}{" "}
                    open)
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Number of applicants
              <input
                type="number"
                name="count"
                min={1}
                max={100}
                defaultValue={25}
                required
                className={control}
              />
            </label>
            <label className="text-sm">
              District
              <select name="district" className={control}>
                <option value="">All districts</option>
                {DISTRICTS.map((d) => (
                  <option key={d}>{d}</option>
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
                defaultValue="University verification call assignment"
                className={control}
              />
            </label>
          </ActionForm>
        </details>
      )}
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-background p-4">
        <label className="text-sm">
          Search assigned applicants
          <input
            name="q"
            defaultValue={q}
            placeholder="Name or SLAA ID"
            className={control}
          />
        </label>
        <label className="text-sm">
          Case status
          <select name="status" defaultValue={status} className={control}>
            <option value="">All statuses</option>
            {Object.entries(CASE_LABELS)
              .filter(([k]) => manager || k !== "unassigned")
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
        </label>
        {manager && (
          <label className="text-sm">
            Assigned staff
            <select name="assignee" defaultValue={assignee} className={control}>
              <option value="">All staff</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name ?? u.email}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="due" value="1" defaultChecked={due} />
          Callbacks due now
        </label>
        <button className="min-h-10 rounded-lg bg-primary px-4 text-sm text-white">
          Filter cases
        </button>
        <Link href="/admin/verification" className="p-2 text-sm text-primary">
          Clear
        </Link>
      </form>
      <p className="text-sm text-muted-foreground">
        {total} matching applicant{total === 1 ? "" : "s"}. Times are shown in
        Sri Lanka time.
      </p>
      <div className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted">
            <tr>
              {[
                "Applicant",
                "District",
                "Case status",
                ...(manager ? ["Assigned to"] : []),
                "Calls",
                "Next callback",
              ].map((h) => (
                <th key={h} className="p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.slaa_id}>
                <td className="p-3">
                  <Link
                    href={`/admin/verification/${r.slaa_id}`}
                    className="font-medium text-primary"
                  >
                    {r.full_name}
                    <span className="block font-mono text-xs">{r.slaa_id}</span>
                  </Link>
                </td>
                <td className="p-3">{r.district}</td>
                <td className="p-3">{CASE_LABELS[r.case_status]}</td>
                {manager && (
                  <td className="p-3">{r.assignee ?? "Unassigned"}</td>
                )}
                <td className="p-3">{r.calls}</td>
                <td className="whitespace-nowrap p-3">
                  {sriLankaTime(r.follow_up_at)}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={manager ? 6 : 5}
                  className="p-8 text-center text-muted-foreground"
                >
                  {manager
                    ? "No matching applicants."
                    : "No applicants assigned to you match these filters. Your supervisor can assign applicants."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between text-sm">
        {page > 1 ? (
          <Link href={qs({ page: String(page - 1) })}>← Previous</Link>
        ) : (
          <span />
        )}
        {page * 50 < total && (
          <Link href={qs({ page: String(page + 1) })}>Next →</Link>
        )}
      </div>
      {manager && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Staff workload</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {staff.map((u) => (
              <Link
                key={u.id}
                href={qs({ assignee: u.id, page: "1", status: "" })}
                className="rounded-xl border bg-background p-4 text-sm"
              >
                <strong className="break-all">
                  {u.display_name ?? u.email}
                </strong>
                {u.organization && <p>{u.organization}</p>}
                <p className="mt-2">
                  {u.assigned} open · {u.due} overdue · {u.approved} verified
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
