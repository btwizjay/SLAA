import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { sql } from "@/lib/db";
import { approveLink } from "../actions";

export const metadata = { title: "Coach confirmations · SLAA admin" };

export default async function ConfirmationsPage() {
  await requireAdmin();
  const rows = await sql<{
    id: number; athlete_id: string; coach_id: string; relationship_type: string; is_primary: boolean;
    start_year: number | null; end_year: number | null; created_at: Date;
    athlete_name: string; coach_name: string; coach_phone: string | null;
  }[]>`
    SELECT ac.*, a.full_name AS athlete_name, c.full_name AS coach_name, c.phone AS coach_phone
    FROM athlete_coach ac
    JOIN member a ON a.slaa_id = ac.athlete_id
    JOIN member c ON c.slaa_id = ac.coach_id
    WHERE NOT ac.is_approved_by_coach AND a.status <> 'merged' AND c.status <> 'merged'
    ORDER BY c.full_name, ac.created_at
    LIMIT 500`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Coach confirmations</h1>
        <p className="text-sm text-muted-foreground">
          Athlete–coach links waiting for the coach to confirm. Approve on the coach&apos;s behalf after speaking to them.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Coach</th>
              <th className="px-3 py-2">Coach phone</th>
              <th className="px-3 py-2">Athlete</th>
              <th className="px-3 py-2">Relationship</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">
                  <Link className="text-primary hover:underline" href={`/admin/members/${r.coach_id}`}>{r.coach_name}</Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{r.coach_phone ? <a href={`tel:${r.coach_phone}`}>{r.coach_phone}</a> : "—"}</td>
                <td className="px-3 py-2">
                  <Link className="text-primary hover:underline" href={`/admin/members/${r.athlete_id}`}>{r.athlete_name}</Link>
                </td>
                <td className="px-3 py-2">
                  {r.relationship_type === "CURRENT" ? "Current" : "Past"}
                  {r.is_primary ? " (primary)" : ""} {[r.start_year, r.end_year].filter(Boolean).join("–")}
                </td>
                <td className="px-3 py-2 text-right">
                  <form action={approveLink}>
                    <input type="hidden" name="linkId" value={r.id} />
                    <button className="h-8 rounded-md bg-emerald-700 px-3 text-xs text-white">Approve</button>
                  </form>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nothing waiting.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
