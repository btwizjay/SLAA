import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { admin, resetDb } from "./support/db";
vi.setConfig({ testTimeout: 20000, hookTimeout: 30000 });
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => jar.set(k, v),
  }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.99" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to });
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const { sql } = await import("@/lib/db");
const { ADMIN_COOKIE, signAdminToken } = await import("@/lib/admin-session");
const { getAdmin, getAdminSession, requireAdmin } = await import(
  "@/lib/admin-auth"
);
const { hasPermission } = await import("@/lib/staff-permissions");
const { getVerificationCase } = await import("@/lib/verification-data");
const { parseCallback } = await import("@/lib/verification");
const { assignVerification, recordVerificationCall, reviewVerification } =
  await import("@/app/admin/(staff)/verification/actions");
const { createStaff, manageStaff } = await import("@/app/admin/auth-actions");
const legacy = await import("@/app/admin/(staff)/actions");
const { editProfile } = await import("@/app/admin/(staff)/suite-actions");
const { GET: exportCsv } = await import("@/app/api/admin/export/route");
const { GET: template } = await import("@/app/api/admin/coach-template/route");
const users: Record<string, { id: string; token: string }> = {};
const ids: string[] = [];
const form = (v: Record<string, string>) => {
  const f = new FormData();
  for (const [k, x] of Object.entries(v)) f.set(k, x);
  return f;
};
const login = (who: string) => {
  jar.set(ADMIN_COOKIE, users[who].token);
};
async function version(id: string) {
  const [v] =
    await admin`SELECT version FROM member_verification WHERE slaa_id=${id}`;
  return String(v?.version ?? 0);
}
async function call(id: string, patch: Record<string, string> = {}) {
  return form({
    slaaId: id,
    version: await version(id),
    outcome: "confirmed",
    respondent: "applicant",
    notes: "Spoke with applicant and checked registration",
    ...patch,
  });
}
const complete = {
  identity: "on",
  contact: "on",
  athletics: "on",
  respondent: "applicant",
  approve: "on",
};
// Respondent type and the attestation checkbox have separate field names.
beforeAll(async () => {
  await resetDb();
  for (const [name, role] of [
    ["owner", "owner"],
    ["supervisor", "supervisor"],
    ["alice", "verifier"],
    ["bob", "verifier"],
  ]) {
    const [u] =
      await admin`INSERT INTO admin_staff(email,password_hash,role,must_change_password,display_name,organization)
      VALUES(${name + "@example.com"},'not-a-real-password-hash',${role},false,${name},'Sabaragamuwa University') RETURNING id`;
    const session = randomUUID();
    await admin`INSERT INTO admin_session(id,staff_id,expires_at) VALUES(${session},${u.id},now()+interval '8 hours')`;
    users[name] = { id: u.id, token: await signAdminToken(u.id, session) };
  }
  for (let i = 0; i < 4; i++) {
    const year = i === 2 ? "2009" : "1995";
    const [m] =
      await admin`INSERT INTO member(slaa_id,nic_as_entered,full_name,date_of_birth,gender,district,phone,consent_version,consent_at)
      VALUES(new_slaa_id('A'),${year + "12300" + String(i + 1).padStart(3, "0")},${"Verification Applicant " + i},${year + "-05-02"},'M','Colombo','+94712345678','test',now()) RETURNING slaa_id`;
    ids.push(m.slaa_id);
    await admin`INSERT INTO athlete(slaa_id,main_events) VALUES(${m.slaa_id},'{100m}')`;
    await admin`INSERT INTO athlete_event(athlete_id,event_code,rank) VALUES(${m.slaa_id},'100m',1)`;
  }
});
afterAll(async () => {
  await sql.end();
  await admin.end();
});
describe("assigned verification and role permissions", () => {
  it("denies unknown roles and restricts broad register access to owner/admin", () => {
    expect(hasPermission("verifier", "manage_register")).toBe(false);
    expect(hasPermission("supervisor", "manage_register")).toBe(false);
    expect(hasPermission("supervisor", "manage_verification")).toBe(true);
    expect(hasPermission("verifier", "verify_applicants")).toBe(true);
    expect(hasPermission("unknown" as "verifier", "verify_applicants")).toBe(
      false,
    );
  });
  it("creates restricted university accounts and rejects a second owner role", async () => {
    login("owner");
    expect(
      (
        await createStaff(
          {},
          form({
            email: "uni@example.com",
            password: "Temporary-Password-12345",
            role: "verifier",
            displayName: "University Caller",
            organization: "Sabaragamuwa University",
          }),
        )
      ).success,
    ).toBeTruthy();
    const [u] =
      await admin`SELECT role,organization,must_change_password FROM admin_staff WHERE email='uni@example.com'`;
    expect(u).toMatchObject({
      role: "verifier",
      organization: "Sabaragamuwa University",
      must_change_password: true,
    });
    expect(
      (
        await createStaff(
          {},
          form({
            email: "bad@example.com",
            password: "Temporary-Password-12345",
            role: "owner",
          }),
        )
      ).error,
    ).toBeTruthy();
  });
  it("blocks direct access to exports, imports, deletion and staff administration", async () => {
    login("alice");
    expect(await getAdmin()).toBeNull();
    await expect(requireAdmin()).rejects.toMatchObject({
      to: "/admin/verification",
    });
    expect(
      (await exportCsv(new Request("https://test/api/admin/export"))).status,
    ).toBe(401);
    expect((await template()).status).toBe(401);
    await expect(
      legacy.deleteMember(
        form({ slaaId: ids[0], confirm: ids[0], reason: "Forged request" }),
      ),
    ).rejects.toMatchObject({ to: "/admin/verification" });
    await expect(
      createStaff(
        {},
        form({
          email: "attacker@example.com",
          password: "Temporary-Password-12345",
        }),
      ),
    ).rejects.toThrow(/owner/);
    login("supervisor");
    await expect(requireAdmin()).rejects.toMatchObject({
      to: "/admin/verification",
    });
    await expect(
      manageStaff(
        {},
        form({ staffId: users.alice.id, operation: "role", role: "admin" }),
      ),
    ).rejects.toThrow(/owner/);
    expect((await admin`SELECT count(*)::int n FROM member`)[0].n).toBe(4);
  });
  it("lets a supervisor assign applicants in batches", async () => {
    login("supervisor");
    expect(
      (
        await assignVerification(
          {},
          form({
            mode: "next",
            count: "2",
            district: "Colombo",
            assigneeId: users.alice.id,
            reason: "University call allocation",
          }),
        )
      ).success,
    ).toContain("2 applicants");
    expect(
      (
        await admin`SELECT count(*)::int n FROM member_verification WHERE assignee_id=${users.alice.id}`
      )[0].n,
    ).toBe(2);
  });
  it("returns only assigned profiles with masked identity and rejects forged calls", async () => {
    login("alice");
    const own = await getVerificationCase(ids[0]);
    expect(own?.identity_hint).toMatch(/NIC ending/);
    expect(JSON.stringify(own)).not.toContain("199512300001");
    expect(await getVerificationCase(ids[2])).toBeNull();
    login("bob");
    expect(await getVerificationCase(ids[0])).toBeNull();
    expect(
      (await recordVerificationCall({}, await call(ids[0]))).error,
    ).toContain("not assigned");
    await expect(
      assignVerification(
        {},
        form({ assigneeId: users.bob.id, reason: "Steal assignment" }),
      ),
    ).rejects.toMatchObject({ to: "/admin/verification" });
    await expect(
      reviewVerification(
        {},
        form({ decision: "reopen", reason: "Forged review" }),
      ),
    ).rejects.toMatchObject({ to: "/admin/verification" });
    expect(
      (await admin`SELECT count(*)::int n FROM verification_contact`)[0].n,
    ).toBe(0);
  });
  it("records callbacks in Sri Lanka time and rejects replayed stale submissions", async () => {
    login("alice");
    const local = new Date(Date.now() + 2 * 86400000)
      .toISOString()
      .slice(0, 16);
    const data = await call(ids[0], {
      outcome: "callback",
      respondent: "not_reached",
      notes: "Applicant requested another call tomorrow",
      followUpAt: local,
    });
    expect((await recordVerificationCall({}, data)).success).toBeTruthy();
    const [v] =
      await admin`SELECT status,follow_up_at FROM member_verification WHERE slaa_id=${ids[0]}`;
    expect(v.status).toBe("callback");
    expect(v.follow_up_at.getTime()).toBe(new Date(local + "+05:30").getTime());
    expect((await recordVerificationCall({}, data)).error).toContain("changed");
    expect(
      (await admin`SELECT count(*)::int n FROM verification_contact`)[0].n,
    ).toBe(1);
    expect(() => parseCallback("2026-02-30T12:30")).toThrow();
    expect(
      (
        await recordVerificationCall(
          {},
          await call(ids[0], { outcome: "callback" }),
        )
      ).error,
    ).toContain("callback");
  });
  it("requires a confirmed conversation and every checklist item for approval", async () => {
    login("alice");
    const data = await call(ids[0], {
      ...complete,
      identity: "on",
      contact: "on",
      athletics: "on",
    });
    expect((await recordVerificationCall({}, data)).error).toContain(
      "every verification check",
    );
    expect(
      (await admin`SELECT status FROM member WHERE slaa_id=${ids[0]}`)[0]
        .status,
    ).toBe("pending");
  });
  it("allows a student verifier to give final approval with an attributed audit", async () => {
    login("alice");
    const data = await call(ids[0], complete);
    data.set("conversation", "on");
    expect((await recordVerificationCall({}, data)).success).toContain(
      "Applicant verified",
    );
    const [v] =
      await admin`SELECT m.status,v.status case_status,v.verified_by FROM member m JOIN member_verification v USING(slaa_id) WHERE m.slaa_id=${ids[0]}`;
    expect(v).toMatchObject({
      status: "verified",
      case_status: "approved",
      verified_by: "alice@example.com",
    });
    const [audit] =
      await admin`SELECT actor,details FROM audit_log WHERE action='verification_approved' AND slaa_id=${ids[0]}`;
    expect(audit.actor).toBe("alice@example.com");
    expect(audit.details.role).toBe("verifier");
    expect(audit.details.notes).toBeUndefined();
    expect((await recordVerificationCall({}, data)).error).toBeTruthy();
  });
  it("requires supervisor reopening before reassignment and preserves call history", async () => {
    login("supervisor");
    expect(
      (
        await assignVerification(
          {},
          form({
            slaaId: ids[0],
            version: await version(ids[0]),
            assigneeId: users.bob.id,
            reason: "Move closed case",
          }),
        )
      ).error,
    ).toContain("Reopen");
    expect(
      (
        await reviewVerification(
          {},
          form({
            slaaId: ids[0],
            version: await version(ids[0]),
            decision: "reopen",
            reason: "Correction requires a second call",
          }),
        )
      ).success,
    ).toContain("reopened");
    expect(
      (await admin`SELECT status FROM member WHERE slaa_id=${ids[0]}`)[0]
        .status,
    ).toBe("pending");
    expect(
      (
        await admin`SELECT count(*)::int n FROM verification_contact WHERE slaa_id=${ids[0]}`
      )[0].n,
    ).toBe(2);
  });
  it("requires a recorded guardian conversation before approving a minor", async () => {
    login("supervisor");
    await assignVerification(
      {},
      form({
        slaaId: ids[2],
        version: "0",
        assigneeId: users.alice.id,
        reason: "Junior athlete call assignment",
      }),
    );
    login("alice");
    const data = await call(ids[2], complete);
    data.set("conversation", "on");
    expect((await recordVerificationCall({}, data)).error).toContain(
      "guardian",
    );
    data.set("respondent", "guardian");
    expect((await recordVerificationCall({}, data)).error).toContain(
      "guardian",
    );
    await admin`INSERT INTO guardian(athlete_id,full_name,relationship,phone,consent_given_at) VALUES(${ids[2]},'Test Guardian','parent','+94771234567',now())`;
    expect((await recordVerificationCall({}, data)).success).toContain(
      "Applicant verified",
    );
  });
  it("flags mismatches, and reassignment immediately removes the previous caller access", async () => {
    login("alice");
    expect(
      (
        await recordVerificationCall(
          {},
          await call(ids[1], {
            outcome: "wrong_number",
            notes: "The recorded number belongs to someone else",
            respondent: "not_reached",
          }),
        )
      ).success,
    ).toBeTruthy();
    expect(
      (
        await admin`SELECT status FROM member_verification WHERE slaa_id=${ids[1]}`
      )[0].status,
    ).toBe("needs_review");
    login("supervisor");
    expect(
      (
        await assignVerification(
          {},
          form({
            slaaId: ids[1],
            version: await version(ids[1]),
            assigneeId: users.bob.id,
            reason: "Supervisor reassigned for follow-up",
          }),
        )
      ).success,
    ).toBeTruthy();
    login("alice");
    expect(await getVerificationCase(ids[1])).toBeNull();
    expect(
      (await recordVerificationCall({}, await call(ids[1]))).error,
    ).toContain("not assigned");
    login("bob");
    expect((await getVerificationCase(ids[1]))?.assignee_id).toBe(users.bob.id);
  });
  it("returns a corrected verified profile to review", async () => {
    login("owner");
    const approval = await call(ids[0], complete);
    approval.set("conversation", "on");
    expect((await recordVerificationCall({}, approval)).success).toBeTruthy();
    const [m] =
      await admin`SELECT updated_at::text version FROM member WHERE slaa_id=${ids[0]}`;
    const correction = form({
      slaaId: ids[0],
      version: m.version,
      identityType: "nic",
      nic: "199512300001",
      fullName: "Corrected University Applicant",
      nameWithInitials: "C. U. Applicant",
      dateOfBirth: "1995-05-02",
      gender: "M",
      district: "Colombo",
      phone: "0712345678",
      email: "",
      schoolOrClub: "Test Club",
      events: JSON.stringify([
        { code: "100m", pb: "", pbYear: "", pbCompetition: "" },
      ]),
      reason: "Applicant supplied corrected profile details",
    });
    const edited = await editProfile({}, correction);
    expect(edited.success).toBeTruthy();
    expect(
      (
        await admin`SELECT m.status,v.status case_status,v.verified_by FROM member m JOIN member_verification v USING(slaa_id) WHERE m.slaa_id=${ids[0]}`
      )[0],
    ).toMatchObject({
      status: "pending",
      case_status: "needs_review",
      verified_by: null,
    });
    const stale = await call(ids[0], complete);
    stale.set("conversation", "on");
    const [latest] =
      await admin`SELECT updated_at::text version FROM member WHERE slaa_id=${ids[0]}`;
    correction.set("version", latest.version);
    correction.set("fullName", "Updated before the next call");
    expect((await editProfile({}, correction)).success).toBeTruthy();
    expect((await recordVerificationCall({}, stale)).error).toContain(
      "changed",
    );
  });
  it("allocates different applicants when supervisors assign batches concurrently", async () => {
    login("supervisor");
    const extra: string[] = [];
    for (let i = 10; i < 16; i++) {
      const [m] =
        await admin`INSERT INTO member(slaa_id,nic_as_entered,full_name,date_of_birth,gender,district,phone,consent_version,consent_at)
        VALUES(new_slaa_id('A'),${"199012300" + String(i).padStart(3, "0")},'Batch Applicant','1990-05-02','M','Colombo','+94712345678','test',now()) RETURNING slaa_id`;
      extra.push(m.slaa_id);
      await admin`INSERT INTO athlete(slaa_id) VALUES(${m.slaa_id})`;
    }
    const results = await Promise.all(
      [users.alice.id, users.bob.id].map((target) =>
        assignVerification(
          {},
          form({
            mode: "next",
            count: "2",
            assigneeId: target,
            reason: "Concurrent university allocation",
          }),
        ),
      ),
    );
    expect(results.every((r) => !!r.success)).toBe(true);
    const assigned =
      await admin`SELECT slaa_id FROM member_verification WHERE slaa_id=ANY(${[ids[3], ...extra]}::text[])`;
    expect(assigned).toHaveLength(4);
    expect(new Set(assigned.map((r) => r.slaa_id)).size).toBe(4);
  });
  it("revokes sessions when the owner changes a role", async () => {
    login("owner");
    expect(
      (
        await manageStaff(
          {},
          form({
            staffId: users.alice.id,
            operation: "role",
            role: "supervisor",
          }),
        )
      ).success,
    ).toBeTruthy();
    login("alice");
    expect(await getAdminSession()).toBeNull();
    expect(
      (await admin`SELECT role FROM admin_staff WHERE id=${users.alice.id}`)[0]
        .role,
    ).toBe("supervisor");
  });
});
