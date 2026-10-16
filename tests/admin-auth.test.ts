import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { admin, resetDb } from "./support/db";
vi.setConfig({ testTimeout: 15_000 });
const { jar, options } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  options: new Map<string, Record<string, unknown>>(),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.90" }),
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string, o: Record<string, unknown>) => {
      jar.set(k, v);
      options.set(k, o);
    },
    delete: (k: string) => jar.delete(k),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to });
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const { sql } = await import("@/lib/db");
const { ADMIN_COOKIE, hashPassword, verifyPassword, readAdminToken } =
  await import("@/lib/admin-session");
const { getAdmin, getAdminSession, requireAdmin, requireOwner } = await import(
  "@/lib/admin-auth"
);
const actions = await import("@/app/admin/auth-actions");
const { GET: exportCsv } = await import("@/app/api/admin/export/route");
const ownerEmail = "owner@example.com",
  staffEmail = "staff@example.com",
  initial = "Initial-Password-12345",
  nextPassword = "Changed-Password-54321";
let ownerId = "",
  staffId = "",
  ownerToken = "";
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
};
beforeAll(async () => {
  await resetDb();
  const hash = await hashPassword(initial);
  const [owner] =
    await admin`INSERT INTO admin_staff(email,password_hash,role,must_change_password) VALUES(${ownerEmail},${hash},'owner',false) RETURNING id`;
  ownerId = owner.id;
  const [staff] =
    await admin`INSERT INTO admin_staff(email,password_hash) VALUES(${staffEmail},${hash}) RETURNING id`;
  staffId = staff.id;
});
afterAll(async () => {
  await sql.end();
  await admin.end();
});
describe("local staff authentication", () => {
  it("hashes passwords with independent salts and rejects wrong passwords", async () => {
    const first = await hashPassword(initial),
      second = await hashPassword(initial);
    expect(first).not.toBe(second);
    expect(first).not.toContain(initial);
    expect(await verifyPassword(initial, first)).toBe(true);
    expect(await verifyPassword("wrong", first)).toBe(false);
  }, 15000);
  it("uses the same failure for unknown email and incorrect password", async () => {
    const unknown = await actions.loginAction(
      {},
      form({ email: "missing@example.com", password: initial }),
    );
    const wrong = await actions.loginAction(
      {},
      form({ email: ownerEmail, password: "wrong-password" }),
    );
    expect(unknown).toEqual(wrong);
    expect(jar.size).toBe(0);
  });
  it("creates a signed HTTP-only session, and rejects tampered tokens", async () => {
    await expect(
      actions.loginAction({}, form({ email: ownerEmail, password: initial })),
    ).rejects.toMatchObject({ to: "/admin/overview" });
    ownerToken = jar.get(ADMIN_COOKIE)!;
    expect(ownerToken.split(".")).toHaveLength(3);
    expect(options.get(ADMIN_COOKIE)).toMatchObject({
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 28800,
    });
    expect(await getAdmin()).toBe(ownerEmail);
    const tampered = ownerToken.slice(0, -5) + "AAAAA";
    expect(await readAdminToken(tampered)).toBeNull();
    jar.set(ADMIN_COOKIE, tampered);
    expect(await getAdmin()).toBeNull();
    jar.set(ADMIN_COOKIE, ownerToken);
  });
  it("expires tokens and rejects unsigned JWTs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 9 * 3600000);
    expect(await readAdminToken(ownerToken)).toBeNull();
    vi.useRealTimers();
    expect(await readAdminToken("eyJhbGciOiJub25lIn0.e30.")).toBeNull();
  });
  it("creates staff accounts with a forced password change", async () => {
    const result = await actions.createStaff(
      {},
      form({ email: "newstaff@example.com", password: initial }),
    );
    expect(result.success).toBeTruthy();
    const [created] =
      await admin`SELECT role,must_change_password,password_hash FROM admin_staff WHERE email='newstaff@example.com'`;
    expect(created).toMatchObject({
      role: "verifier",
      must_change_password: true,
    });
    expect(created.password_hash).not.toContain(initial);
  });
  it("forces the first password change before giving access to data", async () => {
    jar.clear();
    await expect(
      actions.loginAction({}, form({ email: staffEmail, password: initial })),
    ).rejects.toMatchObject({ to: "/admin/account" });
    expect(await getAdmin()).toBeNull();
    await expect(requireAdmin()).rejects.toMatchObject({
      to: "/admin/account",
    });
    expect(
      (await exportCsv(new Request("https://test/api/admin/export"))).status,
    ).toBe(401);
  });
  it("changes the password and revokes every old session", async () => {
    const old = jar.get(ADMIN_COOKIE)!;
    await expect(
      actions.changePassword(
        {},
        form({
          currentPassword: initial,
          newPassword: nextPassword,
          confirmPassword: nextPassword,
        }),
      ),
    ).rejects.toMatchObject({ to: "/admin/overview?passwordChanged=1" });
    const fresh = jar.get(ADMIN_COOKIE)!;
    expect(await getAdmin()).toBe(staffEmail);
    jar.set(ADMIN_COOKIE, old);
    expect(await getAdmin()).toBeNull();
    jar.set(ADMIN_COOKIE, fresh);
    await expect(requireOwner()).rejects.toThrow(/owner/);
    const [staff] =
      await admin`SELECT password_hash,must_change_password FROM admin_staff WHERE id=${staffId}`;
    expect(staff.must_change_password).toBe(false);
    expect(await verifyPassword(initial, staff.password_hash)).toBe(false);
    expect(await verifyPassword(nextPassword, staff.password_hash)).toBe(true);
  });
  it("revokes access immediately on disable and cannot disable the owner", async () => {
    const staffToken = jar.get(ADMIN_COOKIE)!;
    jar.set(ADMIN_COOKIE, ownerToken);
    await actions.manageStaff({}, form({ staffId, operation: "disable" }));
    jar.set(ADMIN_COOKIE, staffToken);
    expect(await getAdmin()).toBeNull();
    jar.set(ADMIN_COOKIE, ownerToken);
    await expect(
      actions.manageStaff({}, form({ staffId: ownerId, operation: "disable" })),
    ).rejects.toThrow(/owner/);
  });
  it("signs out server-side, so copying the old cookie cannot restore access", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(actions.signOut()).rejects.toMatchObject({
      to: "/admin/login",
    });
    expect(jar.get(ADMIN_COOKIE)).toBe("");
    expect(options.get(ADMIN_COOKIE)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    vi.unstubAllEnvs();
    jar.set(ADMIN_COOKIE, ownerToken);
    expect(await getAdmin()).toBeNull();
    jar.clear();
  });
  it("throttles attempts before doing expensive password verification", async () => {
    const { hashIp } = await import("@/lib/guard");
    await admin`SELECT rate_limit_hit(${"adminLoginEmail:" + hashIp("limited@example.com")},10,interval '15 minutes') FROM generate_series(1,11)`;
    expect(
      (
        await actions.loginAction(
          {},
          form({ email: "limited@example.com", password: initial }),
        )
      ).error,
    ).toMatch(/15 minutes/);
  });
  it("never enables the development sign-in shortcut in production", async () => {
    vi.stubEnv("DEV_ADMIN_EMAIL", "attacker@example.com");
    vi.stubEnv("NODE_ENV", "production");
    expect(await getAdminSession()).toBeNull();
    vi.unstubAllEnvs();
  });
});
