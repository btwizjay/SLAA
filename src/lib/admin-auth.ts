import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { ADMIN_COOKIE, readAdminToken } from "./admin-session";
import {
  hasPermission,
  isStaffRole,
  staffHome,
  type StaffRole,
  type StaffPermission,
} from "./staff-permissions";
export type StaffSession = {
  id: string;
  email: string;
  role: StaffRole;
  must_change_password: boolean;
  sessionId: string;
};
export async function getAdminSession(): Promise<StaffSession | null> {
  const dev = process.env.DEV_ADMIN_EMAIL;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (dev && process.env.NODE_ENV === "development" && !token) {
    return {
      id: "dev",
      email: dev,
      role: "owner",
      must_change_password: false,
      sessionId: "dev",
    };
  }
  if (!token) return null;
  const claims = await readAdminToken(token);
  if (!claims) return null;
  const [staff] = await sql<Omit<StaffSession, "sessionId">[]>`
    SELECT u.id, u.email, u.role, u.must_change_password
    FROM admin_staff u JOIN admin_session s ON s.staff_id = u.id
    WHERE u.id = ${claims.staffId}::uuid AND s.id = ${claims.sessionId}::uuid
      AND u.active AND s.revoked_at IS NULL AND s.expires_at > now()`;
  return staff && isStaffRole(staff.role)
    ? { ...staff, sessionId: claims.sessionId }
    : null;
}
export async function getAdmin(): Promise<string | null> {
  const session = await getAdminSession();
  return session &&
    !session.must_change_password &&
    hasPermission(session.role, "manage_register")
    ? session.email
    : null;
}
export async function requireAdminSession(allowPasswordChange = false) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.must_change_password && !allowPasswordChange)
    redirect("/admin/account");
  return session;
}
export async function requireAdmin() {
  return (await requirePermission("manage_register")).email;
}
export async function requirePermission(permission: StaffPermission) {
  const session = await requireAdminSession();
  if (!hasPermission(session.role, permission))
    redirect(staffHome(session.role));
  return session;
}
export async function requireOwner() {
  const session = await requireAdminSession();
  if (session.role !== "owner")
    throw new Error("Only the owner can manage staff accounts.");
  return session;
}
