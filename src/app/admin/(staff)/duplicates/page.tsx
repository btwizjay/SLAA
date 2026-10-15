import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { sqlCoach, sqlAthlete } from "@/lib/db";
import { mergeMembers } from "../actions";
import { StatusBadge } from "../StatusBadge";

export const metadata = { title: "Possible duplicates · SLAA admin" };

type Row = {
  slaa_id: string;
  full_name: string;
  status: string;
  nic: string | null;
  postal_id: string | null;
  created_at: Date;
};

type Group = {
  key: string;
  date_of_birth: string;
  district: string;
  members: Row[];
};

export default async function DuplicatesPage() {
  await requireAdmin();
  let groups: Group[] = [];

  try {
    const queryDuplicates = async (db: typeof sqlCoach) => {
      try {
        return await db<Group[]>`
          SELECT lower(full_name) AS key, date_of_birth::text, district,
                 json_agg(json_build_object(
                   'slaa_id', slaa_id, 'full_name', full_name, 'status', status, 'nic', nic,
                   'postal_id', postal_id, 'created_at', created_at)
                   ORDER BY created_at) AS members
          FROM member
          WHERE status <> 'merged'
          GROUP BY lower(full_name), date_of_birth, district
          HAVING count(*) > 1
          ORDER BY max(created_at) DESC
          LIMIT 100`;
      } catch (err) {
        if (process.env.NODE_ENV !== "production" && (err as { code?: string })?.code === "ECONNREFUSED") {
          return [];
        }
        throw err;
      }
    };

    const [coachGroups, athleteGroups] = await Promise.all([
      queryDuplicates(sqlCoach),
      queryDuplicates(sqlAthlete),
    ]);

    groups = [...coachGroups, ...athleteGroups];
  } catch (err) {
    if (process.env.NODE_ENV !== "production" && (err as { code?: string })?.code === "ECONNREFUSED") {
      console.warn("duplicates: DB offline in dev, returning empty list");
      groups = [];
    } else {
      throw err;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Possible duplicates</h1>
        <p className="text-sm text-muted-foreground">
          Same name, date of birth and district, registered with different IDs. Merging keeps one SLAA ID; the other
          is marked “merged” and its coach links move across.
        </p>
      </div>
      {!groups.length && <p className="rounded-lg border bg-background p-6 text-center text-muted-foreground">No possible duplicates.</p>}
      {groups.map((g) => (
        <section key={g.key + g.date_of_birth + g.district} className="rounded-lg border bg-background p-4">
          <p className="mb-2 text-sm text-muted-foreground">{g.date_of_birth} · {g.district}</p>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {g.members.map((m) => (
                <tr key={m.slaa_id}>
                  <td className="py-1.5 pr-3 font-mono">
                    <Link className="text-primary hover:underline" href={`/admin/members/${m.slaa_id}`}>{m.slaa_id}</Link>
                  </td>
                  <td className="py-1.5 pr-3">{m.full_name}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground font-mono text-xs">{m.nic ?? m.postal_id ?? "—"}</td>
                  <td className="py-1.5 pr-3"><StatusBadge status={m.status} /></td>
                  <td className="py-1.5 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <form action={mergeMembers} className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
            <span className="text-muted-foreground">Keep:</span>
            <select name="keep" className="h-8 rounded-md border border-input bg-background px-2 font-mono text-xs">
              {g.members.map((m) => (
                <option key={m.slaa_id} value={m.slaa_id}>{m.slaa_id} ({m.full_name})</option>
              ))}
            </select>
            <span className="text-muted-foreground">Merge into it:</span>
            <select name="duplicate" className="h-8 rounded-md border border-input bg-background px-2 font-mono text-xs">
              {g.members.map((m) => (
                <option key={m.slaa_id} value={m.slaa_id}>{m.slaa_id} ({m.full_name})</option>
              ))}
            </select>
            <button className="h-8 rounded-md bg-primary px-3 text-xs text-primary-foreground">Merge records</button>
          </form>
        </section>
      ))}
    </div>
  );
}
