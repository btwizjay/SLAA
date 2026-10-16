import "server-only";
import { sql } from "./db";
import { requirePermission, type StaffSession } from "./admin-auth";
import { hasPermission } from "./staff-permissions";
import { isValidSlaaId } from "./slaa-id";
export function verificationScope(session: StaffSession) {
  return hasPermission(session.role, "manage_verification")
    ? sql``
    : sql`AND v.assignee_id=${session.id}::uuid`;
}
export async function verificationStaff() {
  await requirePermission("manage_verification");
  return sql<
    {
      id: string;
      email: string;
      display_name: string | null;
      organization: string | null;
      role: string;
      assigned: number;
      due: number;
      approved: number;
    }[]
  >`
    SELECT s.id,s.email,s.display_name,s.organization,s.role,
      count(v.slaa_id) FILTER(WHERE v.status NOT IN ('approved','rejected'))::int assigned,
      count(v.slaa_id) FILTER(WHERE v.follow_up_at<=now() AND v.status NOT IN ('approved','rejected'))::int due,
      count(v.slaa_id) FILTER(WHERE v.status='approved')::int approved
    FROM admin_staff s LEFT JOIN member_verification v ON v.assignee_id=s.id
      AND EXISTS(SELECT 1 FROM member m WHERE m.slaa_id=v.slaa_id AND m.status IN ('pending','verified'))
    WHERE s.active
    GROUP BY s.id ORDER BY s.display_name NULLS LAST,s.email`;
}
export async function getVerificationCase(id: string) {
  const session = await requirePermission("verify_applicants");
  if (!isValidSlaaId(id)) return null;
  const [record] = await sql`
    SELECT m.slaa_id,m.full_name,m.name_with_initials,m.date_of_birth::text dob,m.gender,m.district,m.phone,m.email,
      m.status member_status,a.school_or_club,
      CASE WHEN m.nic IS NOT NULL THEN 'NIC ending ' || right(m.nic,4)
        WHEN m.postal_id IS NOT NULL THEN 'Postal ID ending ' || right(m.postal_id,4) ELSE 'Identity needs administrator review' END identity_hint,
      v.assignee_id,coalesce(v.status,'unassigned') case_status,coalesce(v.version,0) version,v.follow_up_at,v.verified_by,v.verified_at,
      s.email assignee_email,s.display_name assignee_name,
      g.full_name guardian_name,g.relationship guardian_relationship,g.phone guardian_phone
    FROM member m JOIN athlete a USING(slaa_id)
    LEFT JOIN member_verification v USING(slaa_id) LEFT JOIN admin_staff s ON s.id=v.assignee_id
    LEFT JOIN LATERAL (SELECT full_name,relationship,phone FROM guardian WHERE athlete_id=m.slaa_id ORDER BY id LIMIT 1) g ON true
    WHERE m.slaa_id=${id} AND m.status IN ('pending','verified') ${verificationScope(session)}`;
  return record ?? null;
}
