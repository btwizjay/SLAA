// Client-side NIC parsing. Mirrors normalize_nic() in db/001_schema.sql so the
// form can show the decoded date of birth and gender before submitting.
// The database remains the authority; this is only for early feedback.

export const NIC_REGEX = /^([0-9]{9}[VvXx]|[0-9]{12})$/;

export type NicInfo = {
  normalized: string; // 12-digit form, as stored in member.nic
  dateOfBirth: string; // YYYY-MM-DD
  gender: "M" | "F";
  format: "old" | "new";
};

export type NicResult = { ok: true; info: NicInfo } | { ok: false; error: string };

// NIC day-of-year counts February as 29 days in every year.
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function cleanNic(raw: string): string {
  return (raw ?? "").replace(/\s/g, "").toUpperCase();
}

/** Same result as SQL normalize_nic(), or null when SQL would raise. */
export function normalizeNic(raw: string): string | null {
  let v = cleanNic(raw);
  if (/^[0-9]{9}[VX]$/.test(v)) {
    v = "19" + v.slice(0, 2) + v.slice(2, 5) + "0" + v.slice(5, 9);
  } else if (!/^[0-9]{12}$/.test(v)) {
    return null;
  }
  const ddd = parseInt(v.slice(4, 7), 10);
  if (!((ddd >= 1 && ddd <= 366) || (ddd >= 501 && ddd <= 866))) return null;
  return v;
}

export function parseNic(raw: string, today: Date = new Date()): NicResult {
  const v = cleanNic(raw);
  if (!NIC_REGEX.test(v)) {
    return { ok: false, error: "Enter 9 digits followed by V or X, or 12 digits." };
  }
  const normalized = normalizeNic(v);
  if (!normalized) {
    return { ok: false, error: "This NIC number is not valid (the birth-day digits are out of range)." };
  }

  const year = parseInt(normalized.slice(0, 4), 10);
  let day = parseInt(normalized.slice(4, 7), 10);
  const gender: "M" | "F" = day > 500 ? "F" : "M";
  if (day > 500) day -= 500;

  let month = 0;
  while (day > MONTH_DAYS[month]) {
    day -= MONTH_DAYS[month];
    month++;
  }
  if (month === 1 && day === 29 && !isLeap(year)) {
    return { ok: false, error: "This NIC number is not valid (29 February in a non-leap year)." };
  }

  const dob = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (year < 1900 || dob > today.toISOString().slice(0, 10)) {
    return { ok: false, error: "This NIC number is not valid (birth year out of range)." };
  }

  return {
    ok: true,
    info: { normalized, dateOfBirth: dob, gender, format: v.length === 10 ? "old" : "new" },
  };
}
