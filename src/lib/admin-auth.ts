import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { ADMIN_COOKIE, readAdminToken } from "./admin-session";
export type StaffSession = {
  id: string;
  email: string;
  role: "owner" | "admin";
  must_change_password: boolean;
  sessionId: string;
};
export async function getAdminSession(): Promise<StaffSession | null> {
  const dev = process.env.DEV_ADMIN_EMAIL;
  if (dev && process.env.NODE_ENV === "development") {
    return {
      id: "dev",
      email: dev,
      role: "owner",
      must_change_password: false,
      sessionId: "dev",
    };
  }
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const claims = await readAdminToken(token);
  if (!claims) return null;
  const [staff] = await sql<Omit<StaffSession, "sessionId">[]>`
    SELECT u.id, u.email, u.role, u.must_change_password
    FROM admin_staff u JOIN admin_session s ON s.staff_id = u.id
    WHERE u.id = ${claims.staffId}::uuid AND s.id = ${claims.sessionId}::uuid
      AND u.active AND s.revoked_at IS NULL AND s.expires_at > now()`;
  return staff ? { ...staff, sessionId: claims.sessionId } : null;
}
export async function getAdmin(): Promise<string | null> {
  const session = await getAdminSession();
  return session && !session.must_change_password ? session.email : null;
}
export async function requireAdminSession(allowPasswordChange = false) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.must_change_password && !allowPasswordChange)
    redirect("/admin/account");
  return session;
}
export async function requireAdmin() {
  return (await requireAdminSession()).email;
}
export async function requireOwner() {
  const session = await requireAdminSession();
  if (session.role !== "owner")
    throw new Error("Only the owner can manage staff accounts.");
  return session;
}
