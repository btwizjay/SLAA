import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { sqlCoach, sqlAthlete } from "@/lib/db";
import { normalizeNic } from "@/lib/nic";
import { DISTRICTS } from "@/lib/reference";
import { bulkDeleteMembers } from "./actions";
import { BulkSelectForm, RowBox, SelectAllBox } from "./BulkSelect";
import { StatusBadge } from "./StatusBadge";

export const metadata = { title: "Members · SLAA admin" };

const PAGE = 50;

type Search = {
  deleted?: string;
  bulkDeleted?: string;
  skipped?: string;
  bulkError?: string;
  type?: string;
  district?: string;
  status?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: string;
};

type MemberRow = {
  slaa_id: string;
  full_name: string;
  district: string;
  status: string;
  is_coach: boolean;
  is_athlete: boolean;
  created_at: Date;
};

const control = "h-9 rounded-md border border-input bg-background px-2 text-sm";

export default async function MembersPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const s = await searchParams;
  const page = Math.max(1, Number(s.page) || 1);
  const q = (s.q ?? "").trim();
  const nic = q ? normalizeNic(q) : null;
  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

  let rows: MemberRow[] = [];
  let total = 0;
  let dbOffline = false;

  try {
    const buildWhere = (db: typeof sqlCoach) => db`
      WHERE TRUE
      ${s.district ? db`AND m.district = ${s.district}` : db``}
      ${s.status ? db`AND m.status = ${s.status}` : db``}
      ${isDate(s.from) ? db`AND m.created_at >= ${s.from!}::date` : db``}
      ${isDate(s.to) ? db`AND m.created_at < ${s.to!}::date + 1` : db``}
      ${
        nic
          ? db`AND m.nic = ${nic}`
          : q
            ? db`AND (m.slaa_id ILIKE ${q + "%"} OR m.full_name ILIKE ${"%" + q + "%"}
                       OR m.name_with_initials ILIKE ${"%" + q + "%"} OR m.postal_id = ${q.toUpperCase()})`
            : db``
      }`;

    const queryCoaches = async () => {
      try {
        const where = buildWhere(sqlCoach);
        const [cRows, countResult] = await Promise.all([
          sqlCoach<MemberRow[]>`
            SELECT m.slaa_id, m.full_name, m.district, m.status, m.created_at,
                   true AS is_coach, false AS is_athlete
            FROM member m JOIN coach c USING (slaa_id)
            ${where}
            ORDER BY m.created_at DESC
            LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`,
          sqlCoach<{ count: number }[]>`
            SELECT count(*)::int AS count
            FROM member m JOIN coach c USING (slaa_id)
            ${where}`,
        ]);
        return { rows: cRows, count: countResult[0]?.count ?? 0 };
      } catch (err) {
        if (process.env.NODE_ENV !== "production" && (err as { code?: string })?.code === "ECONNREFUSED") {
          dbOffline = true;
          return { rows: [], count: 0 };
        }
        throw err;
      }
    };

    const queryAthletes = async () => {
      try {
        const where = buildWhere(sqlAthlete);
        const [aRows, countResult] = await Promise.all([
          sqlAthlete<MemberRow[]>`
            SELECT m.slaa_id, m.full_name, m.district, m.status, m.created_at,
                   false AS is_coach, true AS is_athlete
            FROM member m JOIN athlete a USING (slaa_id)
            ${where}
            ORDER BY m.created_at DESC
            LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`,
          sqlAthlete<{ count: number }[]>`
            SELECT count(*)::int AS count
            FROM member m JOIN athlete a USING (slaa_id)
            ${where}`,
        ]);
        return { rows: aRows, count: countResult[0]?.count ?? 0 };
      } catch (err) {
        if (process.env.NODE_ENV !== "production" && (err as { code?: string })?.code === "ECONNREFUSED") {
          dbOffline = true;
          return { rows: [], count: 0 };
        }
        throw err;
      }
    };

    if (s.type === "coach") {
      const res = await queryCoaches();
      rows = res.rows;
      total = res.count;
    } else if (s.type === "athlete") {
      const res = await queryAthletes();
      rows = res.rows;
      total = res.count;
    } else {
      const [coachRes, athleteRes] = await Promise.all([queryCoaches(), queryAthletes()]);
      total = coachRes.count + athleteRes.count;
      rows = [...coachRes.rows, ...athleteRes.rows]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, PAGE);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production" && (err as { code?: string })?.code === "ECONNREFUSED") {
      dbOffline = true;
      rows = [];
      total = 0;
    } else {
      console.error("Admin MembersPage query error:", err);
      throw err;
    }
  }

  const qs = (patch: Partial<Search>) => {
    const p = new URLSearchParams(
      Object.entries({
        ...s,
        deleted: undefined,
        bulkDeleted: undefined,
        skipped: undefined,
        bulkError: undefined,
        ...patch,
      }).filter(([, v]) => v) as [string, string][],
    );
    return `?${p}`;
  };

  return (
    <div className="flex flex-col gap-4">
      {dbOffline && (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">⚠️ Database Offline in Development</p>
          <p className="mt-0.5 text-xs text-amber-700">
            PostgreSQL is unreachable in local development. Connect a database to view live member records.
          </p>
        </div>
      )}
      {s.deleted && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Account <span className="font-mono">{s.deleted}</span> and its personal details were deleted.
        </p>
      )}
      {s.bulkDeleted && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {s.bulkDeleted} account{s.bulkDeleted === "1" ? " was" : "s were"} deleted.
          {s.skipped && (
            <> Not deleted (other records were merged into them, or already gone):{" "}
              <span className="font-mono">{s.skipped.split(",").join(", ")}</span></>
          )}
        </p>
      )}
      {s.bulkError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {{
            selection: "Select between 1 and 100 accounts.",
            confirm: "Type DELETE exactly to confirm. Nothing was deleted.",
            reason: "Please give a reason. Nothing was deleted.",
          }[s.bulkError] ?? "Nothing was deleted."}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Members <span className="text-base font-normal text-muted-foreground">({total})</span></h1>
        <div className="flex gap-2 text-sm">
          <a className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted" href="/api/admin/export?type=members">Export all CSV</a>
          <a className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted" href="/api/admin/export?type=coaches">Export coaches CSV</a>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2 rounded-lg border bg-background p-3">
        <input name="q" defaultValue={q} placeholder="Name, SLAA ID or NIC" className={control + " w-56"} />
        <select name="type" defaultValue={s.type ?? ""} className={control}>
          <option value="">All types</option>
          <option value="coach">Coaches</option>
          <option value="athlete">Athletes</option>
        </select>
        <select name="district" defaultValue={s.district ?? ""} className={control}>
          <option value="">All districts</option>
          {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select name="status" defaultValue={s.status ?? ""} className={control}>
          <option value="">Any status</option>
          {["pending", "verified", "suspended", "merged"].map((x) => <option key={x}>{x}</option>)}
        </select>
        <label className="flex flex-col text-xs text-muted-foreground">From
          <input type="date" name="from" defaultValue={s.from} className={control} />
        </label>
        <label className="flex flex-col text-xs text-muted-foreground">To
          <input type="date" name="to" defaultValue={s.to} className={control} />
        </label>
        <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">Filter</button>
        <Link href="/admin" className="h-9 px-2 text-sm leading-9 text-muted-foreground underline">Clear</Link>
      </form>

      <BulkSelectForm action={bulkDeleteMembers}>
      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-8 px-3 py-2"><SelectAllBox /></th>
              <th className="px-3 py-2">SLAA ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">District</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.slaa_id} className="hover:bg-muted/40 has-checked:bg-red-50">
                <td className="px-3 py-2"><RowBox id={r.slaa_id} label={r.full_name} /></td>
                <td className="px-3 py-2 font-mono">
                  <Link className="text-primary hover:underline" href={`/admin/members/${r.slaa_id}`}>{r.slaa_id}</Link>
                </td>
                <td className="px-3 py-2">{r.full_name}</td>
                <td className="px-3 py-2">{[r.is_coach && "Coach", r.is_athlete && "Athlete"].filter(Boolean).join(", ")}</td>
                <td className="px-3 py-2">{r.district}</td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2 whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString("en-GB") : ""}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No members match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      </BulkSelectForm>

      <div className="flex justify-between text-sm">
        {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="text-primary">← Previous</Link> : <span />}
        {page * PAGE < total && <Link href={qs({ page: String(page + 1) })} className="text-primary">Next →</Link>}
      </div>
    </div>
  );
}
