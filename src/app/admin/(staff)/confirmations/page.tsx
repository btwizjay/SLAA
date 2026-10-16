import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { sql } from "@/lib/db";
import { reviewLink } from "../suite-actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { StatusBadge } from "../StatusBadge";

export const metadata = { title: "Coach confirmations · SLAA admin" };

export default async function ConfirmationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireAdmin();
  const s = await searchParams;
  const status = ["pending", "approved", "rejected"].includes(s.status ?? "")
    ? s.status!
    : "pending";
  const page = Math.min(100000, Math.max(1, parseInt(s.page ?? "1", 10) || 1));
  const rows = await sql<
    {
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
      review_status: string;
      review_reason: string | null;
    }[]
  >`
    SELECT ac.*, a.full_name AS athlete_name, c.full_name AS coach_name, c.phone AS coach_phone
    FROM athlete_coach ac
    JOIN member a ON a.slaa_id = ac.athlete_id
    JOIN member c ON c.slaa_id = ac.coach_id
    WHERE ac.review_status=${status} AND a.status <> 'merged' AND c.status <> 'merged'
    ORDER BY c.full_name, ac.created_at
    LIMIT 51 OFFSET ${(page - 1) * 50}`;
  const hasNext = rows.length > 50;
  const visible = rows.slice(0, 50);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Coach confirmations</h1>
        <p className="text-sm text-muted-foreground">
          Review athlete–coach links after contacting the coach. Rejected links
          remain in the history.
        </p>
      </div>
      <nav className="flex flex-wrap gap-4 text-sm">
        {["pending", "approved", "rejected"].map((value) => (
          <Link
            className={value === status ? "font-semibold" : "text-primary"}
            key={value}
            href={`?status=${value}`}
          >
            {value}
          </Link>
        ))}
      </nav>
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
            {visible.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">
                  <Link
                    className="text-primary hover:underline"
                    href={`/admin/members/${r.coach_id}`}
                  >
                    {r.coach_name}
                  </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.coach_phone ? (
                    <a href={`tel:${r.coach_phone}`}>{r.coach_phone}</a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  <Link
                    className="text-primary hover:underline"
                    href={`/admin/members/${r.athlete_id}`}
                  >
                    {r.athlete_name}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {r.relationship_type === "CURRENT" ? "Current" : "Past"}
                  {r.is_primary ? " (primary)" : ""}{" "}
                  {[r.start_year, r.end_year].filter(Boolean).join("–")}
                  <p className="mt-1">
                    <StatusBadge status={r.review_status} />
                  </p>
                  {r.review_reason && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.review_reason}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <ActionForm
                    action={reviewLink}
                    submit="Save review"
                    className="min-w-56 text-left"
                  >
                    <input type="hidden" name="linkId" value={r.id} />
                    <label className="text-xs">
                      Decision
                      <select
                        name="decision"
                        defaultValue={
                          status === "pending" ? "approved" : "pending"
                        }
                        className="mt-1 block h-9 w-full rounded-lg border px-2"
                      >
                        <option value="approved">Approve</option>
                        <option value="rejected">Reject</option>
                        <option value="pending">Return to pending</option>
                      </select>
                    </label>
                    <label className="text-xs">
                      Review reason
                      <input
                        name="reason"
                        required
                        maxLength={500}
                        className="mt-1 h-9 w-full rounded-lg border px-2"
                      />
                    </label>
                  </ActionForm>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  Nothing waiting.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between text-sm">
        {page > 1 ? (
          <Link href={`?status=${status}&page=${page - 1}`}>← Previous</Link>
        ) : (
          <span />
        )}
        {hasNext && (
          <Link href={`?status=${status}&page=${page + 1}`}>Next →</Link>
        )}
      </div>
    </div>
  );
}
