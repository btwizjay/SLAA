import Link from "next/link";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isValidSlaaId } from "@/lib/slaa-id";
export const metadata = { title: "Audit log · SLAA admin" };
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const s = await searchParams;
  const page = Math.min(100000, Math.max(1, parseInt(s.page ?? "1", 10) || 1));
  const action = (s.action ?? "").slice(0, 80),
    actor = (s.actor ?? "").trim().slice(0, 254),
    id = (s.id ?? "").trim().toUpperCase();
  const where = sql`WHERE true ${action ? sql`AND action=${action}` : sql``} ${actor ? sql`AND actor=${actor}` : sql``} ${isValidSlaaId(id) ? sql`AND slaa_id=${id}` : sql``}`;
  const [rows, [{ total }], actions] = await Promise.all([
    sql`SELECT * FROM audit_log ${where} ORDER BY at DESC,id DESC LIMIT 50 OFFSET ${(page - 1) * 50}`,
    sql`SELECT count(*)::int total FROM audit_log ${where}`,
    sql`SELECT DISTINCT action FROM audit_log ORDER BY action`,
  ]);
  const link = (p: number) =>
    `?${new URLSearchParams({ action, actor, id, page: String(p) })}`;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">
        Audit log{" "}
        <span className="text-base font-normal text-muted-foreground">
          ({total})
        </span>
      </h1>
      <p className="text-sm text-muted-foreground">
        An append-only history of staff changes, registrations, imports and
        exports.
      </p>
      <form className="flex flex-wrap gap-2 rounded-xl border bg-background p-3">
        <label className="text-xs">
          Action
          <select
            name="action"
            defaultValue={action}
            className="mt-1 block h-10 rounded-lg border px-2"
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a.action}>{a.action}</option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Actor
          <input
            name="actor"
            defaultValue={actor}
            className="mt-1 block h-10 rounded-lg border px-2"
          />
        </label>
        <label className="text-xs">
          SLAA ID
          <input
            name="id"
            defaultValue={id}
            className="mt-1 block h-10 rounded-lg border px-2"
          />
        </label>
        <button className="self-end rounded-lg bg-primary px-4 py-2 text-sm text-white">
          Filter audit log
        </button>
        <Link href="/admin/audit" className="self-end p-2 text-sm text-primary">
          Clear
        </Link>
      </form>
      <div className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              {["Time (Sri Lanka)", "Actor", "Action", "Member", "Details"].map(
                (x) => (
                  <th key={x} className="p-3">
                    {x}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap p-3">
                  {r.at.toLocaleString("en-GB", { timeZone: "Asia/Colombo" })}
                </td>
                <td className="p-3">{r.actor}</td>
                <td className="p-3">{r.action}</td>
                <td className="p-3 font-mono">
                  {r.slaa_id ? (
                    <Link
                      href={`/admin/members/${r.slaa_id}`}
                      className="text-primary"
                    >
                      {r.slaa_id}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="max-w-sm break-words p-3 font-mono text-xs">
                  {JSON.stringify(r.details)}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={5}
                  className="p-8 text-center text-muted-foreground"
                >
                  No matching audit records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between text-sm">
        {page > 1 ? <Link href={link(page - 1)}>← Previous</Link> : <span />}
        {page * 50 < total && <Link href={link(page + 1)}>Next →</Link>}
      </div>
    </div>
  );
}
