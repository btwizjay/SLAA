import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { sql } from "@/lib/db";
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

export default async function DuplicatesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;
  const groups = await sql<
    { key: string; date_of_birth: string; district: string; members: Row[] }[]
  >`
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
    LIMIT 200`;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          Give a reason and type the kept SLAA ID to confirm merging. Nothing
          was changed.
        </p>
      )}
      <div>
        <h1 className="text-2xl font-bold">Possible duplicates</h1>
        <p className="text-sm text-muted-foreground">
          Same name, date of birth and district, registered with different IDs.
          Merging keeps one SLAA ID; the other is marked “merged” and its coach
          links move across.
        </p>
      </div>
      {!groups.length && (
        <p className="rounded-lg border bg-background p-6 text-center text-muted-foreground">
          No possible duplicates.
        </p>
      )}
      {groups.map((g) => (
        <section
          key={g.key + g.date_of_birth + g.district}
          className="rounded-lg border bg-background p-4"
        >
          <p className="mb-2 text-sm text-muted-foreground">
            {g.date_of_birth} · {g.district}
          </p>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {g.members.map((m) => (
                <tr key={m.slaa_id}>
                  <td className="py-1.5 pr-3 font-mono">
                    <Link
                      className="text-primary hover:underline"
                      href={`/admin/members/${m.slaa_id}`}
                    >
                      {m.slaa_id}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3">{m.full_name}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">
                    {m.nic ?? m.postal_id}
                  </td>
                  <td className="py-1.5">
                    <StatusBadge status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <form
            action={mergeMembers}
            className="mt-3 flex flex-wrap items-center gap-2 text-sm"
          >
            Keep
            <select
              name="keep"
              className="h-9 rounded-md border px-2 font-mono"
            >
              {g.members.map((m) => (
                <option key={m.slaa_id}>{m.slaa_id}</option>
              ))}
            </select>
            and merge
            <select
              name="duplicate"
              defaultValue={g.members[1].slaa_id}
              className="h-9 rounded-md border px-2 font-mono"
            >
              {g.members.map((m) => (
                <option key={m.slaa_id}>{m.slaa_id}</option>
              ))}
            </select>
            into it
            <label className="text-xs">
              Reason
              <input
                name="reason"
                required
                maxLength={500}
                className="ml-2 h-9 rounded-md border px-2"
              />
            </label>
            <label className="text-xs">
              Type kept SLAA ID
              <input
                name="confirm"
                required
                className="ml-2 h-9 rounded-md border px-2 font-mono"
              />
            </label>
            <button className="h-9 rounded-md bg-primary px-4 text-primary-foreground">
              Merge
            </button>
          </form>
        </section>
      ))}
    </div>
  );
}
