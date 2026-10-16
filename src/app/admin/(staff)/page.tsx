import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { sql } from "@/lib/db";
import { memberFilters, memberWhere } from "@/lib/admin-filters";
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
  school?: string;
  ageCategory?: string;
};

const control = "h-9 rounded-md border border-input bg-background px-2 text-sm";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireAdmin();
  const s = await searchParams;
  const filters = memberFilters(s);
  const { page, q } = filters;
  const where = memberWhere(filters);

  const [rows, [{ total }]] = await Promise.all([
    sql<
      {
        slaa_id: string;
        full_name: string;
        district: string;
        status: string;
        is_coach: boolean;
        is_athlete: boolean;
        created_at: Date;
      }[]
    >`
      SELECT m.slaa_id, m.full_name, m.district, m.status, m.created_at,
             c.slaa_id IS NOT NULL AS is_coach, a.slaa_id IS NOT NULL AS is_athlete
      FROM member m LEFT JOIN coach c USING (slaa_id) LEFT JOIN athlete a USING (slaa_id)
      ${where}
      ORDER BY m.created_at DESC, m.slaa_id
      LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`,
    sql<{ total: number }[]>`
      SELECT count(*)::int AS total
      FROM member m LEFT JOIN coach c USING (slaa_id) LEFT JOIN athlete a USING (slaa_id)
      ${where}`,
  ]);

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
      {s.deleted && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          Account <span className="font-mono">{s.deleted}</span> and its
          personal details were deleted.
        </p>
      )}
      {s.bulkDeleted && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {s.bulkDeleted} account{s.bulkDeleted === "1" ? " was" : "s were"}{" "}
          deleted.
          {s.skipped && (
            <>
              {" "}
              Not deleted (other records were merged into them, or already
              gone):{" "}
              <span className="font-mono">
                {s.skipped.split(",").join(", ")}
              </span>
            </>
          )}
        </p>
      )}
      {s.bulkError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {{
            selection: "Select between 1 and 100 accounts.",
            confirm: "Type DELETE exactly to confirm. Nothing was deleted.",
            reason: "Please give a reason. Nothing was deleted.",
          }[s.bulkError] ?? "Nothing was deleted."}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">
          Members{" "}
          <span className="text-base font-normal text-muted-foreground">
            ({total})
          </span>
        </h1>
        <div className="flex flex-wrap gap-2 text-sm">
          <a
            className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted"
            href={
              "/api/admin/export?" +
              new URLSearchParams(
                Object.entries({ ...s, format: "members" }).filter(
                  ([, v]) => typeof v === "string",
                ) as [string, string][],
              )
            }
          >
            Export filtered CSV
          </a>
          <a
            className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted"
            href="/api/admin/export?type=coaches"
          >
            Export coaches CSV
          </a>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2 rounded-lg border bg-background p-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Name, SLAA ID or NIC"
          className={control + " w-full sm:w-56"}
        />
        <select name="type" defaultValue={s.type ?? ""} className={control}>
          <option value="">All types</option>
          <option value="coach">Coaches</option>
          <option value="athlete">Athletes</option>
        </select>
        <select
          name="district"
          defaultValue={s.district ?? ""}
          className={control}
        >
          <option value="">All districts</option>
          {DISTRICTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select name="status" defaultValue={s.status ?? ""} className={control}>
          <option value="">Any status</option>
          {["pending", "verified", "suspended", "merged"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <input
          name="school"
          defaultValue={s.school ?? ""}
          placeholder="School / club"
          className={control + " w-40"}
        />
        <select
          name="ageCategory"
          defaultValue={s.ageCategory ?? ""}
          className={control}
        >
          <option value="">All ages</option>
          {["U14", "U16", "U18", "U20", "Senior", "Masters"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label className="flex flex-col text-xs text-muted-foreground">
          From
          <input
            type="date"
            name="from"
            defaultValue={s.from}
            className={control}
          />
        </label>
        <label className="flex flex-col text-xs text-muted-foreground">
          To
          <input
            type="date"
            name="to"
            defaultValue={s.to}
            className={control}
          />
        </label>
        <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">
          Filter
        </button>
        <Link
          href="/admin"
          className="h-9 px-2 text-sm leading-9 text-muted-foreground underline"
        >
          Clear
        </Link>
      </form>

      <BulkSelectForm action={bulkDeleteMembers}>
        <div className="overflow-x-auto rounded-lg border bg-background">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-2">
                  <SelectAllBox />
                </th>
                <th className="px-3 py-2">SLAA ID</th>
                <th className="px-3 py-2">Name</th>
                <th className="hidden px-3 py-2 sm:table-cell">Type</th>
                <th className="hidden px-3 py-2 md:table-cell">District</th>
                <th className="px-3 py-2">Status</th>
                <th className="hidden px-3 py-2 lg:table-cell">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr
                  key={r.slaa_id}
                  className="hover:bg-muted/40 has-checked:bg-red-50"
                >
                  <td className="px-3 py-2">
                    <RowBox id={r.slaa_id} label={r.full_name} />
                  </td>
                  <td className="px-3 py-2 font-mono">
                    <Link
                      className="text-primary hover:underline"
                      href={`/admin/members/${r.slaa_id}`}
                    >
                      {r.slaa_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.full_name}</td>
                  <td className="hidden px-3 py-2 sm:table-cell">
                    {[r.is_coach && "Coach", r.is_athlete && "Athlete"]
                      .filter(Boolean)
                      .join(", ")}
                  </td>
                  <td className="hidden px-3 py-2 md:table-cell">
                    {r.district}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="hidden px-3 py-2 whitespace-nowrap lg:table-cell">
                    {r.created_at.toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    No members match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </BulkSelectForm>

      <div className="flex justify-between text-sm">
        {page > 1 ? (
          <Link href={qs({ page: String(page - 1) })} className="text-primary">
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        {page * PAGE < total && (
          <Link href={qs({ page: String(page + 1) })} className="text-primary">
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}
