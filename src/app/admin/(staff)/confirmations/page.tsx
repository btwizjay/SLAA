import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { sqlCoach, sqlAthlete } from "@/lib/db";
import { approveLink } from "../actions";

export const metadata = { title: "Coach confirmations · SLAA admin" };

type ConfirmationRow = {
  id: number;
  athlete_id: string;
  coach_id: string;
  relationship_type: string;
  is_primary: boolean;
  start_year: number | null;
  end_year: number | null;
  created_at: Date;
  athlete_name: string;
  coach_name: string;
  coach_phone: string | null;
};

export default async function ConfirmationsPage() {
  await requireAdmin();
  let rows: ConfirmationRow[] = [];

  try {
    const acRows = await sqlAthlete<{
      id: number;
      athlete_id: string;
      coach_id: string;
      relationship_type: string;
      is_primary: boolean;
      start_year: number | null;
      end_year: number | null;
      created_at: Date;
      athlete_name: string;
    }[]>`
      SELECT ac.id, ac.athlete_id, ac.coach_id, ac.relationship_type, ac.is_primary,
             ac.start_year, ac.end_year, ac.created_at,
             a.full_name AS athlete_name
      FROM athlete_coach ac
      JOIN member a ON a.slaa_id = ac.athlete_id
      WHERE NOT ac.is_approved_by_coach AND a.status <> 'merged'
      ORDER BY ac.created_at
      LIMIT 500`;

    const coachIds = [...new Set(acRows.map((r) => r.coach_id))];
    const coachMap = new Map<string, { full_name: string; phone: string | null }>();

    if (coachIds.length > 0) {
      try {
        const coaches = await sqlCoach<{ slaa_id: string; full_name: string; phone: string | null }[]>`
          SELECT slaa_id, full_name, phone FROM member WHERE slaa_id IN ${sqlCoach(coachIds)}`;
        for (const c of coaches) coachMap.set(c.slaa_id, c);
      } catch {
        // Non-fatal if coach DB lookup fails
      }
    }

    rows = acRows.map((r) => ({
      ...r,
      coach_name: coachMap.get(r.coach_id)?.full_name ?? r.coach_id,
      coach_phone: coachMap.get(r.coach_id)?.phone ?? null,
    }));
  } catch (err) {
    if (process.env.NODE_ENV !== "production" && (err as { code?: string })?.code === "ECONNREFUSED") {
      console.warn("confirmations: DB offline in dev, returning empty list");
      rows = [];
    } else {
      throw err;
    }
  }

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
                  <Link className="font-semibold text-primary hover:underline" href={`/admin/members/${r.coach_id}`}>
                    {r.coach_name}
                  </Link>
                  <span className="block font-mono text-xs text-muted-foreground">{r.coach_id}</span>
                </td>
                <td className="px-3 py-2">{r.coach_phone ?? "—"}</td>
                <td className="px-3 py-2">
                  <Link className="font-semibold text-primary hover:underline" href={`/admin/members/${r.athlete_id}`}>
                    {r.athlete_name}
                  </Link>
                  <span className="block font-mono text-xs text-muted-foreground">{r.athlete_id}</span>
                </td>
                <td className="px-3 py-2">
                  {r.relationship_type === "CURRENT" ? "Current" : "Past"}
                  {r.is_primary && " · Primary"}
                  {(r.start_year || r.end_year) && (
                    <span className="block text-xs text-muted-foreground">
                      {[r.start_year, r.end_year].filter(Boolean).join("–")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <form action={approveLink}>
                    <input type="hidden" name="linkId" value={r.id} />
                    <button className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90">
                      Approve link
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No links waiting for confirmation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
