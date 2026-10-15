import { describe, expect, it } from "vitest";
import { normalizeNic, parseNic } from "@/lib/nic";
import { checkDigit, isValidSlaaId } from "@/lib/slaa-id";

describe("NIC", () => {
  it("normalises old format to 12 digits", () => {
    expect(normalizeNic("853202937V")).toBe("198532002937");
  });

  it("accepts lowercase v and x", () => {
    expect(normalizeNic("853202937v")).toBe("198532002937");
    expect(normalizeNic("853202937x")).toBe("198532002937");
  });

  it("accepts the new 12-digit format unchanged", () => {
    expect(normalizeNic("198532002937")).toBe("198532002937");
  });

  it("decodes date of birth and gender (male)", () => {
    const r = parseNic("853202937V");
    expect(r.ok && r.info).toMatchObject({ dateOfBirth: "1985-11-15", gender: "M", format: "old" });
  });

  it("decodes day-of-year 500+ as female", () => {
    const r = parseNic("858202937V"); // 820 - 500 = day 320
    expect(r.ok && r.info).toMatchObject({ dateOfBirth: "1985-11-15", gender: "F" });
  });

  it("counts February as 29 days in every year", () => {
    // day 60 is 29 Feb: valid in 2000 (leap), invalid in 2001
    expect(parseNic("200006001234")).toMatchObject({ ok: true, info: { dateOfBirth: "2000-02-29" } });
    expect(parseNic("200106001234").ok).toBe(false);
    // day 61 is 1 March in both
    expect(parseNic("200106101234")).toMatchObject({ ok: true, info: { dateOfBirth: "2001-03-01" } });
    expect(parseNic("200136601234")).toMatchObject({ ok: true, info: { dateOfBirth: "2001-12-31" } });
  });

  it("rejects invalid day-of-year 400", () => {
    expect(normalizeNic("854002937V")).toBeNull();
    expect(parseNic("854002937V").ok).toBe(false);
  });

  it("rejects bad lengths and characters", () => {
    for (const bad of ["85320293V", "8532029371V", "12345678901", "1234567890123", "85320293AV", ""]) {
      expect(parseNic(bad).ok, bad).toBe(false);
    }
  });

  it("ignores spaces", () => {
    expect(normalizeNic(" 8532 02937 V ")).toBe("198532002937");
  });
});

describe("SLAA ID check digit", () => {
  it("matches the SQL function for C26-000001", () => {
    // SELECT slaa_check_digit('C26-000001') = 3 (verified against 001_schema.sql)
    expect(checkDigit("C26-000001")).toBe(3);
    expect(isValidSlaaId("C26-000001-3")).toBe(true);
    expect(isValidSlaaId("C26-000001-4")).toBe(false);
  });

  it("catches a single mistyped digit", () => {
    expect(isValidSlaaId("C26-000010-3")).toBe(false);
  });
});
