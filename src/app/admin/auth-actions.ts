"use server";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { hashIp, clientIp } from "@/lib/guard";
import {
  getAdminSession,
  requireAdminSession,
  requireOwner,
} from "@/lib/admin-auth";
import {
  ADMIN_COOKIE,
  SESSION_SECONDS,
  hashPassword,
  signAdminToken,
  verifyPassword,
} from "@/lib/admin-session";
import type { ActionState } from "@/lib/admin-ui";
import { staffHome } from "@/lib/staff-permissions";

const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use at most 128 characters.")
  .refine(
    (value) => value.trim().length >= 12,
    "Use at least 12 characters apart from leading or trailing spaces.",
  );
const dummyHash = `scrypt-v1$${"0".repeat(32)}$${"0".repeat(128)}`;
async function setSession(staffId: string, sessionId: string) {
  (await cookies()).set(
    ADMIN_COOKIE,
    await signAdminToken(staffId, sessionId),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_SECONDS,
    },
  );
}
export async function loginAction(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const email = String(data.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(data.get("password") ?? "");
  if (!z.email().safeParse(email).success || !password || password.length > 128)
    return { error: "Email or password is incorrect." };
  let destination = "/admin/overview";
  try {
    const h = await headers();
    const ip = clientIp(new Request("http://internal", { headers: h }));
    const [limit] = await sql<{ ok: boolean }[]>`
      SELECT rate_limit_hit(${"adminLoginIp:" + hashIp(ip)}, 30, interval '15 minutes')
        AND rate_limit_hit(${"adminLoginEmail:" + hashIp(email)}, 10, interval '15 minutes') AS ok`;
    if (!limit.ok)
      return { error: "Too many sign-in attempts. Please wait 15 minutes." };
    const [staff] =
      await sql`SELECT id, password_hash, active, must_change_password, role FROM admin_staff WHERE email = ${email}`;
    const valid = await verifyPassword(
      password,
      staff?.password_hash ?? dummyHash,
    );
    if (!staff || !staff.active || !valid)
      return { error: "Email or password is incorrect." };
    const sessionId = randomUUID();
    await sql.begin(async (tx) => {
      const [current] =
        await tx`SELECT active, password_hash FROM admin_staff WHERE id = ${staff.id} FOR UPDATE`;
      if (!current?.active || current.password_hash !== staff.password_hash)
        throw new Error("Credentials changed");
      await tx`INSERT INTO admin_session(id, staff_id, expires_at) VALUES (${sessionId}, ${staff.id}, now() + interval '8 hours')`;
      await tx`UPDATE admin_staff SET last_login_at = now() WHERE id = ${staff.id}`;
      await tx`INSERT INTO audit_log(actor, action) VALUES (${email}, 'admin_login')`;
    });
    await setSession(staff.id, sessionId);
    destination = staffHome(staff.role);
    if (staff.must_change_password) destination = "/admin/account";
  } catch {
    return { error: "Sign-in is temporarily unavailable. Please try again." };
  }
  redirect(destination);
}
export async function signOut() {
  const session = await getAdminSession();
  if (session && session.id !== "dev")
    await sql`UPDATE admin_session SET revoked_at = now() WHERE id = ${session.sessionId}`;
  (await cookies()).set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  redirect("/admin/login");
}
export async function changePassword(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const session = await requireAdminSession(true);
  if (session.id === "dev")
    return { error: "Use a real staff account to change a password." };
  const password = passwordSchema.safeParse(data.get("newPassword"));
  if (!password.success) return { error: password.error.issues[0].message };
  if (password.data !== data.get("confirmPassword"))
    return { error: "The new passwords do not match." };
  const oldPassword = String(data.get("currentPassword") ?? "");
  if (!oldPassword || oldPassword.length > 128 || oldPassword === password.data)
    return {
      error: "Enter your current password and choose a different new password.",
    };
  const [staff] =
    await sql`SELECT password_hash FROM admin_staff WHERE id = ${session.id}`;
  if (!(await verifyPassword(oldPassword, staff.password_hash)))
    return { error: "Your current password is incorrect." };
  const hash = await hashPassword(password.data);
  const nextId = randomUUID();
  await sql.begin(async (tx) => {
    const [locked] =
      await tx`SELECT active, password_hash FROM admin_staff WHERE id = ${session.id} FOR UPDATE`;
    if (!locked?.active || locked.password_hash !== staff.password_hash)
      throw new Error("Credentials changed; sign in again.");
    await tx`UPDATE admin_staff SET password_hash = ${hash}, must_change_password = false WHERE id = ${session.id}`;
    await tx`UPDATE admin_session SET revoked_at = now() WHERE staff_id = ${session.id} AND revoked_at IS NULL`;
    await tx`INSERT INTO admin_session(id, staff_id, expires_at) VALUES (${nextId}, ${session.id}, now() + interval '8 hours')`;
    await tx`INSERT INTO audit_log(actor, action) VALUES (${session.email}, 'admin_password_changed')`;
  });
  await setSession(session.id, nextId);
  revalidatePath("/admin", "layout");
  redirect(staffHome(session.role) + "?passwordChanged=1");
}
export async function createStaff(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const owner = await requireOwner();
  const parsed = z
    .object({
      email: z.email().max(254),
      password: passwordSchema,
      role: z.enum(["admin", "supervisor", "verifier"]).default("verifier"),
      displayName: z.string().trim().max(120),
      organization: z.string().trim().max(120),
    })
    .safeParse({
      email: String(data.get("email") ?? "")
        .trim()
        .toLowerCase(),
      password: data.get("password"),
      role: data.get("role") ?? undefined,
      displayName: String(data.get("displayName") ?? ""),
      organization: String(data.get("organization") ?? ""),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const hash = await hashPassword(parsed.data.password);
  try {
    await sql.begin(async (tx) => {
      await tx`INSERT INTO admin_staff(email, password_hash,role,display_name,organization) VALUES (${parsed.data.email}, ${hash},${parsed.data.role},${parsed.data.displayName || null},${parsed.data.organization || null})`;
      await tx`INSERT INTO audit_log(actor, action, details) VALUES (${owner.email}, 'staff_created', ${tx.json({ email: parsed.data.email, role: parsed.data.role })})`;
    });
  } catch (e) {
    return {
      error:
        (e as { code?: string }).code === "23505"
          ? "A staff account already exists for this email."
          : "Could not create the staff account.",
    };
  }
  revalidatePath("/admin/staff");
  return {
    success:
      "Staff account created. Share its temporary password securely; it must be changed at first sign-in.",
  };
}
export async function revokeOtherSessions(): Promise<ActionState> {
  const session = await requireAdminSession();
  if (session.id === "dev")
    return { error: "Use a real staff account to manage sessions." };
  await sql.begin(async (tx) => {
    await tx`UPDATE admin_session SET revoked_at=now() WHERE staff_id=${session.id} AND id<>${session.sessionId} AND revoked_at IS NULL`;
    await tx`INSERT INTO audit_log(actor,action) VALUES(${session.email},'admin_other_sessions_revoked')`;
  });
  revalidatePath("/admin/account");
  return { success: "All other sessions have been signed out." };
}
export async function manageStaff(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const owner = await requireOwner();
  const id = String(data.get("staffId") ?? "");
  const operation = String(data.get("operation") ?? "");
  if (
    !z.uuid().safeParse(id).success ||
    !["disable", "enable", "revoke", "reset", "role"].includes(operation)
  )
    return { error: "Choose a valid staff action." };
  const temporary =
    operation === "reset"
      ? passwordSchema.safeParse(data.get("password"))
      : null;
  if (temporary && !temporary.success)
    return { error: temporary.error.issues[0].message };
  const hash = temporary?.success ? await hashPassword(temporary.data) : null;
  const role =
    operation === "role"
      ? z.enum(["admin", "supervisor", "verifier"]).safeParse(data.get("role"))
      : null;
  if (role && !role.success) return { error: "Choose a valid staff role." };
  await sql.begin(async (tx) => {
    const [staff] =
      await tx`SELECT email, role FROM admin_staff WHERE id = ${id} FOR UPDATE`;
    if (!staff || staff.role === "owner")
      throw new Error(
        "The owner account cannot be changed from staff management.",
      );
    if (operation === "disable" || operation === "enable")
      await tx`UPDATE admin_staff SET active = ${operation === "enable"} WHERE id = ${id}`;
    if (hash)
      await tx`UPDATE admin_staff SET password_hash = ${hash}, must_change_password = true WHERE id = ${id}`;
    if (role?.success)
      await tx`UPDATE admin_staff SET role=${role.data} WHERE id=${id}`;
    if (operation !== "enable")
      await tx`UPDATE admin_session SET revoked_at = now() WHERE staff_id = ${id} AND revoked_at IS NULL`;
    await tx`INSERT INTO audit_log(actor, action, details) VALUES (${owner.email}, ${"staff_" + operation}, ${tx.json({ email: staff.email, ...(role?.success ? { old_role: staff.role, new_role: role.data } : {}) })})`;
  });
  revalidatePath("/admin/staff");
  return { success: "Staff account updated." };
}
