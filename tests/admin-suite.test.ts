import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { admin, resetDb } from "./support/db";
let signedIn = true;
vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: async () => {
    if (!signedIn) throw new Error("Not signed in");
    return "staff@example.com";
  },
  getAdmin: async () => (signedIn ? "staff@example.com" : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const { sql } = await import("@/lib/db");
const { editProfile, createCoach, reviewLink, saveCoachLink } = await import(
  "@/app/admin/(staff)/suite-actions"
);
const { importCoaches } = await import(
  "@/app/admin/(staff)/coaches/import-actions"
);
const { GET: exportCsv } = await import("@/app/api/admin/export/route");
const { GET: template } = await import("@/app/api/admin/coach-template/route");
const { parseCsv, toCsv } = await import("@/lib/csv");
let athleteId = "",
  coachId = "";
const form = (input: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(input)) data.set(k, v);
  return data;
};
const person = (over: Record<string, string> = {}) => ({
  fullName: "Admin Test Person",
  nameWithInitials: "A. T. Person",
  identityType: "nic",
  nic: "199512300111",
  dateOfBirth: "1995-05-02",
  gender: "M",
  district: "Colombo",
  phone: "0712345678",
  email: "",
  licenseNo: "",
  licenseLevel: "",
  reason: "Reviewed source",
  consent: "on",
  ...over,
});
beforeAll(async () => {
  await resetDb();
  const [m] =
    await admin`INSERT INTO member(slaa_id,nic_as_entered,full_name,name_with_initials,date_of_birth,gender,district,phone,consent_version,consent_at) VALUES(new_slaa_id('A'),'199512300111','Admin Test Person','A. T. Person','1995-05-02','M','Colombo','+94712345678','test',now()) RETURNING slaa_id`;
  athleteId = m.slaa_id;
  await admin`INSERT INTO athlete(slaa_id,school_or_club,main_events) VALUES(${athleteId},'Original Club','{100m}')`;
  await admin`INSERT INTO athlete_event(athlete_id,event_code,rank) VALUES(${athleteId},'100m',1)`;
});
afterAll(async () => {
  await sql.end();
  await admin.end();
});
async function edit(over: Record<string, string> = {}) {
  const [m] =
    await admin`SELECT updated_at::text version FROM member WHERE slaa_id=${athleteId}`;
  return form({
    ...person(),
    slaaId: athleteId,
    version: m.version,
    schoolOrClub: "Updated Club",
    events: JSON.stringify([
      { code: "200m", pb: "23.50", pbYear: "2025", pbCompetition: "Nationals" },
      { code: "LJ", pb: "6.10", pbYear: "", pbCompetition: "" },
    ]),
    ...over,
  });
}
describe("admin feature suite", () => {
  it("creates coaches with server-derived NIC demographics", async () => {
    const result = await createCoach(
      {},
      form(
        person({
          nic: "198512300222",
          fullName: "Registered Coach",
          dateOfBirth: "1970-01-01",
          gender: "F",
        }),
      ),
    );
    expect(result.success).toMatch(/Coach profile ready/);
    const [c] =
      await admin`SELECT m.slaa_id,m.gender,m.date_of_birth::text dob FROM member m JOIN coach c USING(slaa_id) WHERE m.nic='198512300222'`;
    coachId = c.slaa_id;
    expect(c.gender).toBe("M");
    expect(c.dob).toBe("1985-05-02");
  });
  it("requires explicit confirmation before giving an existing athlete a coach role", async () => {
    expect((await createCoach({}, form(person()))).error).toContain("Confirm");
    expect(
      (await createCoach({}, form(person({ linkExisting: "on" })))).success,
    ).toContain(athleteId);
    expect((await admin`SELECT count(*)::int n FROM member`)[0].n).toBe(2);
  });
  it("corrects a profile and replaces PB events atomically, with audit records", async () => {
    const result = await editProfile(
      {},
      await edit({ fullName: "Corrected Person" }),
    );
    expect(result.success).toBeTruthy();
    expect(
      (await admin`SELECT full_name FROM member WHERE slaa_id=${athleteId}`)[0]
        .full_name,
    ).toBe("Corrected Person");
    expect(
      await admin`SELECT event_code,rank,personal_best FROM athlete_event WHERE athlete_id=${athleteId} ORDER BY rank`,
    ).toEqual([
      { event_code: "200m", rank: 1, personal_best: "23.50" },
      { event_code: "LJ", rank: 2, personal_best: "6.10" },
    ]);
    expect(
      (
        await admin`SELECT school_or_club FROM member WHERE slaa_id=${athleteId}`
      )[0].school_or_club,
    ).toBe("Updated Club");
    expect(
      (
        await admin`SELECT count(*)::int n FROM audit_log WHERE action IN ('edit_events','edit_profile')`
      )[0].n,
    ).toBe(2);
  });
  it("detects concurrent edits and does not overwrite newer data", async () => {
    const data = await edit();
    await admin`UPDATE member SET full_name='Newer Change' WHERE slaa_id=${athleteId}`;
    expect((await editProfile({}, data)).error).toMatch(/Another staff member/);
    expect(
      (await admin`SELECT full_name FROM member WHERE slaa_id=${athleteId}`)[0]
        .full_name,
    ).toBe("Newer Change");
  });
  it("rolls back profile corrections when identity uniqueness fails", async () => {
    const before =
      await admin`SELECT event_code FROM athlete_event WHERE athlete_id=${athleteId} ORDER BY rank`;
    expect(
      (
        await editProfile(
          {},
          await edit({ nic: "198512300222", fullName: "Wrong Merge" }),
        )
      ).error,
    ).toContain("already registered");
    expect(
      await admin`SELECT event_code FROM athlete_event WHERE athlete_id=${athleteId} ORDER BY rank`,
    ).toEqual(before);
  });
  it("rejects duplicate events and null event replacement without deleting data", async () => {
    const bad = JSON.stringify([
      { code: "100m", pb: "", pbYear: "", pbCompetition: "" },
      { code: "100m", pb: "", pbYear: "", pbCompetition: "" },
    ]);
    expect((await editProfile({}, await edit({ events: bad }))).error).toMatch(
      /once/,
    );
    await expect(
      sql`SELECT admin_replace_events(${athleteId},NULL,'staff@example.com','Invalid test')`,
    ).rejects.toMatchObject({ code: "22023" });
    expect(
      (
        await admin`SELECT count(*)::int n FROM athlete_event WHERE athlete_id=${athleteId}`
      )[0].n,
    ).toBe(2);
  });
  it("adds, reviews, rejects and reopens a coach relationship", async () => {
    const result = await saveCoachLink(
      {},
      form({
        athleteId,
        coachId,
        relationship: "CURRENT",
        startYear: "2023",
        endYear: "",
        isPrimary: "on",
        reason: "Checked record",
      }),
    );
    expect(result.success).toBeTruthy();
    const [l] =
      await admin`SELECT id FROM athlete_coach WHERE athlete_id=${athleteId} AND coach_id=${coachId}`;
    for (const decision of ["approved", "rejected", "pending"]) {
      expect(
        (
          await reviewLink(
            {},
            form({ linkId: String(l.id), decision, reason: "Contacted coach" }),
          )
        ).success,
      ).toBeTruthy();
      const [row] =
        await admin`SELECT review_status,is_approved_by_coach,is_primary FROM athlete_coach WHERE id=${l.id}`;
      expect(row.review_status).toBe(decision);
      expect(row.is_approved_by_coach).toBe(decision === "approved");
      if (decision === "rejected") expect(row.is_primary).toBe(false);
    }
  });
  it("prevents self-coaching and links to suspended coaches", async () => {
    const base = {
      athleteId,
      coachId: athleteId,
      relationship: "CURRENT",
      startYear: "",
      endYear: "",
      reason: "Test",
    };
    expect((await saveCoachLink({}, form(base))).error).toMatch(/themselves/);
    await admin`UPDATE member SET status='suspended' WHERE slaa_id=${coachId}`;
    expect((await saveCoachLink({}, form({ ...base, coachId }))).error).toMatch(
      /active/,
    );
    await admin`UPDATE member SET status='pending' WHERE slaa_id=${coachId}`;
  });
  it("exports the same filtered member set and supports every export dataset", async () => {
    const response = await exportCsv(
      new Request(
        "https://test/api/admin/export?format=members&district=Colombo&school=Updated",
      ),
    );
    const rows = parseCsv(await response.text());
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe(athleteId);
    for (const format of ["athletes", "coaches", "events", "links", "requests"])
      expect(
        (
          await exportCsv(
            new Request("https://test/api/admin/export?format=" + format),
          )
        ).status,
      ).toBe(200);
    expect(
      (await exportCsv(new Request("https://test/api/admin/export?format=bad")))
        .status,
    ).toBe(400);
  });
  it("blocks unauthenticated management and exports", async () => {
    signedIn = false;
    await expect(createCoach({}, form(person()))).rejects.toThrow(/signed in/);
    expect(
      (await exportCsv(new Request("https://test/api/admin/export"))).status,
    ).toBe(401);
    expect((await template()).status).toBe(401);
    signedIn = true;
  });
  it("previews imports without inserting rows or reserving ID serials, then commits the reviewed file", async () => {
    const csv =
      "full_name,nic,district,events\nImported Coach,197512300333,Kandy,100m;200m\n";
    const before = (
      await admin`SELECT last_value::text value FROM coach_id_seq`
    )[0].value;
    const preview = await importCoaches({}, form({ csv, mode: "preview" }));
    expect(preview.error).toBeUndefined();
    expect(preview.rows).toHaveLength(1);
    expect(
      (await admin`SELECT last_value::text value FROM coach_id_seq`)[0].value,
    ).toBe(before);
    const committed = await importCoaches(
      {},
      form({
        csv,
        mode: "commit",
        token: preview.token!,
        consent: "on",
        reason: "Verified coach sheet",
      }),
    );
    expect(committed.success).toContain("1 new coaches");
    expect(
      (
        await admin`SELECT count(*)::int n FROM member WHERE nic='197512300333'`
      )[0].n,
    ).toBe(1);
    const replay = await importCoaches(
      {},
      form({
        csv,
        mode: "commit",
        token: preview.token!,
        consent: "on",
        reason: "Repeat",
      }),
    );
    expect(replay.error).toMatch(/changed/);
  });
  it("rejects invalid rows and tampered previews before writing anything", async () => {
    const before = (await admin`SELECT count(*)::int n FROM member`)[0].n;
    const csv = "full_name,nic,district\nWrong,invalid,Kandy\n";
    expect(
      (await importCoaches({}, form({ csv, mode: "preview" }))).error,
    ).toMatch(/Row 2/);
    const valid = "full_name,nic,district\nAnother Coach,196512300444,Kandy\n";
    const preview = await importCoaches(
      {},
      form({ csv: valid, mode: "preview" }),
    );
    const bad = await importCoaches(
      {},
      form({
        csv: valid.replace("Another", "Tampered"),
        mode: "commit",
        token: preview.token!,
        consent: "on",
        reason: "Test",
      }),
    );
    expect(bad.error).toMatch(/changed/);
    expect((await admin`SELECT count(*)::int n FROM member`)[0].n).toBe(before);
  });
  it("handles CSV quoting and prevents spreadsheet formulas on export", () => {
    expect(
      parseCsv('name,note\r\n"One, Person","A ""quoted"" note"\r\n'),
    ).toEqual([
      ["name", "note"],
      ["One, Person", 'A "quoted" note'],
    ]);
    expect(() => parseCsv('name\n"unclosed')).toThrow(/not closed/);
    expect(
      toCsv(
        [{ name: '  =HYPERLINK("bad")', phone: "+94712345678" }],
        ["name", "phone"],
      ),
    ).toContain("'  =HYPERLINK");
  });
});
