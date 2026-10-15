import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { sqlCoach, sqlAthlete } from "@/lib/db";
import { EVENTS } from "@/lib/reference";
import { deleteMember, suspendMember, verifyMember } from "../../actions";
import { StatusBadge } from "../../StatusBadge";

export const metadata = { title: "Member · SLAA admin" };

const eventName = (c: string) => EVENTS.find((e) => e.code === c)?.name ?? c;
const fmt = (d: Date | null) => (d ? new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Colombo" }) : "");

const DELETE_ERRORS: Record<string, string> = {
  confirm: "The SLAA ID you typed did not match. Nothing was deleted.",
  reason: "Please give a reason for deleting. Nothing was deleted.",
  merged: "Other records were merged into this one, so it cannot be deleted.",
};

type MemberRow = {
  slaa_id: string;
  nic: string | null;
  nic_as_entered: string | null;
  postal_id: string | null;
  birth_cert_no?: string | null;
  full_name: string;
  name_with_initials: string | null;
  dob: string;
  gender: string;
  district: string;
  phone: string | null;
  email: string | null;
  consent_version: string;
  consent_at: Date;
  created_at: Date;
  status: string;
  merged_into: string | null;
};

type CoachProfile = {
  slaa_license_no: string | null;
  license_level: string | null;
  disciplines: string[];
  is_verified: boolean;
  verified_by: string | null;
  verified_at: Date | null;
};

type AthleteProfile = {
  school_or_club: string | null;
  main_events: string[];
};

type GuardianRow = {
  id: number;
  full_name: string;
  relationship: string;
  phone: string;
  nic: string | null;
  consent_given_at: Date;
};

type CoachLinkRow = {
  id: number;
  coach_id: string;
  athlete_id: string;
  relationship_type: string;
  is_primary: boolean;
  start_year: number | null;
  end_year: number | null;
  is_approved_by_coach: boolean;
  full_name: string;
  status?: string;
};

type RequestRow = {
  id: number;
  coach_name: string;
  coach_phone: string | null;
  coach_district: string | null;
  status: string;
};

type AuditRow = {
  id: number;
  at: Date;
  action: string;
  actor: string;
  details: unknown;
};

export default async function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ deleteError?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { deleteError } = await searchParams;
  const slaaId = decodeURIComponent(id).toUpperCase();
  const isCoach = slaaId.startsWith("C");
  const primaryDb = isCoach ? sqlCoach : sqlAthlete;

  let m: MemberRow | null = null;
  let coach: CoachProfile | null = null;
  let athlete: AthleteProfile | null = null;
  let guardians: GuardianRow[] = [];
  let coaches: CoachLinkRow[] = [];
  let athletes: CoachLinkRow[] = [];
  let requests: RequestRow[] = [];
  let audit: AuditRow[] = [];

  try {
    const [memberRow] = await primaryDb<MemberRow[]>`
      SELECT *, date_of_birth::text AS dob FROM member WHERE slaa_id = ${slaaId}`;
    if (!memberRow) notFound();
    m = memberRow;

    if (isCoach) {
      const [[coachRow], auditRows] = await Promise.all([
        sqlCoach<CoachProfile[]>`SELECT * FROM coach WHERE slaa_id = ${slaaId}`,
        sqlCoach<AuditRow[]>`SELECT * FROM audit_log WHERE slaa_id = ${slaaId} ORDER BY at DESC LIMIT 100`,
      ]);
      coach = coachRow ?? null;
      audit = auditRows ?? [];

      try {
        athletes = await sqlAthlete<CoachLinkRow[]>`
          SELECT ac.*, mm.full_name, mm.status
          FROM athlete_coach ac
          JOIN member mm ON mm.slaa_id = ac.athlete_id
          WHERE ac.coach_id = ${slaaId}
          ORDER BY ac.relationship_type, ac.id`;
      } catch {
        athletes = [];
      }
    } else {
      const [[athleteRow], guardianRows, requestRows, auditRows, rawCoaches] = await Promise.all([
        sqlAthlete<AthleteProfile[]>`SELECT * FROM athlete WHERE slaa_id = ${slaaId}`,
        sqlAthlete<GuardianRow[]>`SELECT * FROM guardian WHERE athlete_id = ${slaaId} ORDER BY id`,
        sqlAthlete<RequestRow[]>`SELECT * FROM coach_request WHERE requested_by = ${slaaId} ORDER BY id`,
        sqlAthlete<AuditRow[]>`SELECT * FROM audit_log WHERE slaa_id = ${slaaId} ORDER BY at DESC LIMIT 100`,
        sqlAthlete<Omit<CoachLinkRow, "full_name">[]>`
          SELECT ac.*
          FROM athlete_coach ac
          WHERE ac.athlete_id = ${slaaId}
          ORDER BY ac.relationship_type, ac.id`,
      ]);
      athlete = athleteRow ?? null;
      guardians = guardianRows ?? [];
      requests = requestRows ?? [];
      audit = auditRows ?? [];

      const coachIds = [...new Set((rawCoaches ?? []).map((c) => c.coach_id))];
      const coachMap = new Map<string, { full_name: string; status: string }>();
      if (coachIds.length > 0) {
        try {
          const coachMembers = await sqlCoach<{ slaa_id: string; full_name: string; status: string }[]>`
            SELECT slaa_id, full_name, status FROM member WHERE slaa_id IN ${sqlCoach(coachIds)}`;
          for (const cm of coachMembers) coachMap.set(cm.slaa_id, cm);
        } catch {
          // Non-fatal if Coach DB unavailable
        }
      }
      coaches = (rawCoaches ?? []).map((c) => ({
        ...c,
        full_name: coachMap.get(c.coach_id)?.full_name ?? c.coach_id,
        status: coachMap.get(c.coach_id)?.status ?? "verified",
      }));
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production" && (err as { code?: string })?.code === "ECONNREFUSED") {
      notFound();
    }
    throw err;
  }

  const identity = [
    m.nic && ["NIC", `${m.nic} (entered as ${m.nic_as_entered})`],
    m.postal_id && ["Postal ID", m.postal_id],
    m.birth_cert_no && ["Birth certificate", m.birth_cert_no],
  ].filter(Boolean) as [string, string][];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{m.slaa_id}</p>
          <h1 className="text-2xl font-bold">{m.full_name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <StatusBadge status={m.status} />
            {coach && <span>Coach</span>}
            {athlete && <span>Athlete</span>}
            {m.merged_into && (
              <span>→ merged into <Link className="text-primary underline" href={`/admin/members/${m.merged_into}`}>{m.merged_into}</Link></span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(m.status === "pending" || m.status === "suspended") && (
            <form action={verifyMember}>
              <input type="hidden" name="slaaId" value={m.slaa_id} />
              <button className="h-9 rounded-md bg-emerald-700 px-4 text-sm text-white">
                {m.status === "suspended" ? "Reinstate (verified)" : "Verify"}
              </button>
            </form>
          )}
          {(m.status === "pending" || m.status === "verified") && (
            <form action={suspendMember} className="flex gap-2">
              <input type="hidden" name="slaaId" value={m.slaa_id} />
              <input name="reason" placeholder="Reason" className="h-9 w-40 rounded-md border px-2 text-sm" />
              <button className="h-9 rounded-md border border-red-300 px-4 text-sm text-red-700">Suspend</button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Personal details">
          <Dl rows={[
            ...identity,
            ["Name with initials", m.name_with_initials],
            ["Date of birth", m.dob],
            ["Gender", m.gender === "F" ? "Female" : "Male"],
            ["District", m.district],
            ["Phone", m.phone],
            ["Email", m.email],
            ["Consent", `${m.consent_version} at ${fmt(m.consent_at)}`],
            ["Registered", fmt(m.created_at)],
          ]} />
        </Card>

        {coach && (
          <Card title="Coach profile">
            <Dl rows={[
              ["Licence no.", coach.slaa_license_no],
              ["Licence level", coach.license_level],
              ["Events", coach.disciplines ? coach.disciplines.map(eventName).join(", ") : "—"],
              ["Verified", coach.is_verified ? `by ${coach.verified_by} at ${fmt(coach.verified_at)}` : "No"],
            ]} />
          </Card>
        )}

        {athlete && (
          <Card title="Athlete profile">
            <Dl rows={[
              ["School or club", athlete.school_or_club],
              ["Main events", athlete.main_events ? athlete.main_events.map(eventName).join(", ") : "—"],
            ]} />
          </Card>
        )}

        {guardians.map((g) => (
          <Card key={g.id} title="Guardian">
            <Dl rows={[
              ["Name", g.full_name],
              ["Relationship", g.relationship],
              ["Phone", g.phone],
              ["NIC", g.nic],
              ["Consent", fmt(g.consent_given_at)],
            ]} />
          </Card>
        ))}
      </div>

      {athlete && (
        <Card title="Coaches">
          <LinkTable rows={coaches} who="coach_id" />
          {requests.length > 0 && (
            <div className="mt-3 text-sm">
              <p className="font-medium">Coach requests (not yet registered)</p>
              <ul className="mt-1 list-disc pl-5">
                {requests.map((r) => (
                  <li key={r.id}>{r.coach_name} · {r.coach_phone} · {r.coach_district ?? "no district"} · <StatusBadge status={r.status} /></li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
      {coach && (
        <Card title="Athletes">
          <LinkTable rows={athletes} who="athlete_id" />
        </Card>
      )}

      <section className="rounded-lg border border-red-200 bg-background p-4">
        <h2 className="font-semibold text-red-800">Delete account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently removes this person&apos;s details, coach links, guardian details and coach requests. This cannot
          be undone. The person could then register again with the same ID. The audit log keeps only who deleted it,
          when, and the reason.
        </p>
        {deleteError && DELETE_ERRORS[deleteError] && (
          <p role="alert" className="mt-2 text-sm text-red-700">{DELETE_ERRORS[deleteError]}</p>
        )}
        <details className="mt-3" open={!!deleteError}>
          <summary className="cursor-pointer text-sm font-medium text-red-700">Delete this account…</summary>
          <form action={deleteMember} className="mt-3 flex flex-col gap-2 text-sm sm:max-w-md">
            <input type="hidden" name="slaaId" value={m.slaa_id} />
            <label htmlFor="del-reason">Reason</label>
            <input id="del-reason" name="reason" required maxLength={500} placeholder="e.g. Test entry, person asked to be removed"
              className="h-9 rounded-md border px-2" />
            <label htmlFor="del-confirm">Type <span className="font-mono font-semibold">{m.slaa_id}</span> to confirm</label>
            <input id="del-confirm" name="confirm" required autoComplete="off" className="h-9 rounded-md border px-2 font-mono uppercase" />
            <button className="h-9 self-start rounded-md bg-red-700 px-4 text-white">Delete permanently</button>
          </form>
        </details>
      </section>

      <Card title="Audit history">
        <ul className="divide-y text-sm">
          {audit.map((a) => (
            <li key={a.id} className="flex flex-wrap gap-x-3 py-1.5">
              <span className="text-muted-foreground">{fmt(a.at)}</span>
              <span className="font-medium">{a.action}</span>
              <span>{a.actor}</span>
              <span className="font-mono text-xs text-muted-foreground">{JSON.stringify(a.details)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-background p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Dl({ rows }: { rows: [string, unknown][] }) {
  return (
    <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="break-words">{v ? String(v) : "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function LinkTable({ rows, who }: { rows: CoachLinkRow[]; who: "coach_id" | "athlete_id" }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">None.</p>;
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y">
        {rows.map((r) => (
          <tr key={String(r.id)}>
            <td className="py-1.5 pr-3 font-mono">
              <Link className="text-primary hover:underline" href={`/admin/members/${r[who]}`}>{String(r[who])}</Link>
            </td>
            <td className="py-1.5 pr-3">{String(r.full_name)}</td>
            <td className="py-1.5 pr-3">{r.relationship_type === "CURRENT" ? "Current" : "Past"}{r.is_primary ? " (primary)" : ""}</td>
            <td className="py-1.5 pr-3">{[r.start_year, r.end_year].filter(Boolean).join("–")}</td>
            <td className="py-1.5">{r.is_approved_by_coach ? "Confirmed" : "Awaiting coach"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
