import Link from "next/link";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
export const metadata = { title: "Overview · SLAA admin" };
export default async function OverviewPage() {
  await requireAdmin();
  const [[stats], districts, recent, days] = await Promise.all([
    sql`SELECT count(*) FILTER (WHERE status <> 'merged')::int members,
      count(*) FILTER (WHERE status = 'pending')::int pending,
      count(*) FILTER (WHERE status = 'suspended')::int suspended,
      count(*) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Colombo')::date = (now() AT TIME ZONE 'Asia/Colombo')::date)::int today,
      (SELECT count(*)::int FROM athlete a JOIN member m USING(slaa_id) WHERE m.status <> 'merged') athletes,
      (SELECT count(*)::int FROM coach c JOIN member m USING(slaa_id) WHERE m.status <> 'merged') coaches,
      (SELECT count(*)::int FROM coach_request WHERE status IN ('pending','invited')) requests,
      (SELECT count(*)::int FROM athlete_coach ac JOIN member a ON a.slaa_id=ac.athlete_id JOIN member c ON c.slaa_id=ac.coach_id WHERE ac.review_status='pending' AND a.status <> 'merged' AND c.status <> 'merged') confirmations
      FROM member`,
    sql`SELECT district, count(*)::int total FROM member WHERE status <> 'merged' GROUP BY district ORDER BY total DESC, district`,
    sql`SELECT slaa_id, full_name, district, created_at FROM member WHERE status <> 'merged' ORDER BY created_at DESC LIMIT 8`,
    sql`SELECT d::date::text AS day_label, count(m.slaa_id)::int total FROM generate_series((now() AT TIME ZONE 'Asia/Colombo')::date - 6, (now() AT TIME ZONE 'Asia/Colombo')::date, interval '1 day') d
      LEFT JOIN member m ON (m.created_at AT TIME ZONE 'Asia/Colombo')::date = d::date GROUP BY d ORDER BY d`,
  ]);
  const cards = [
    ["Active records", stats.members, "/admin"],
    ["Athletes", stats.athletes, "/admin?type=athlete"],
    ["Coaches", stats.coaches, "/admin?type=coach"],
    ["Registered today", stats.today, "/admin"],
    ["Awaiting verification", stats.pending, "/admin?status=pending"],
    ["Suspended", stats.suspended, "/admin?status=suspended"],
    ["Open coach requests", stats.requests, "/admin/coach-requests"],
    ["Awaiting coach review", stats.confirmations, "/admin/confirmations"],
  ] as const;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Register overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live registration and review queues. Dates use Sri Lanka time.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value, href]) => (
          <Link
            key={label}
            href={href}
            className="rounded-xl border bg-background p-4 shadow-xs hover:border-primary/40"
          >
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border bg-background p-5">
          <h2 className="mb-4 font-semibold">
            Registrations in the last seven days
          </h2>
          <div className="space-y-3">
            {days.map((d) => (
              <div
                key={d.day_label}
                className="grid grid-cols-[6rem_1fr_2rem] items-center gap-3 text-sm"
              >
                <span>{d.day_label}</span>
                <span className="h-3 rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{
                      width: `${(Number(d.total) / Math.max(1, ...days.map((x) => Number(x.total)))) * 100}%`,
                    }}
                  />
                </span>
                <span className="text-right">{d.total}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-xl border bg-background p-5">
          <h2 className="mb-4 font-semibold">District coverage</h2>
          {districts.length ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {districts.map((d) => (
                <Link
                  key={d.district}
                  href={`/admin?district=${encodeURIComponent(d.district)}`}
                  className="flex justify-between gap-2 rounded-lg p-2 hover:bg-muted"
                >
                  <span>{d.district}</span>
                  <strong>{d.total}</strong>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No registrations yet.
            </p>
          )}
        </section>
      </div>
      <section className="rounded-xl border bg-background p-5">
        <div className="mb-3 flex justify-between">
          <h2 className="font-semibold">Recent registrations</h2>
          <Link className="text-sm text-primary" href="/admin">
            All members →
          </Link>
        </div>
        <ul className="divide-y">
          {recent.map((m) => (
            <li key={m.slaa_id}>
              <Link
                href={`/admin/members/${m.slaa_id}`}
                className="flex flex-wrap justify-between gap-2 py-3 text-sm hover:text-primary"
              >
                <span>
                  <strong>{m.full_name}</strong>
                  <span className="ml-2 font-mono text-xs">{m.slaa_id}</span>
                </span>
                <span className="text-muted-foreground">{m.district}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
