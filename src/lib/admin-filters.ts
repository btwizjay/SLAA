import { sql } from "./db";
import { normalizeNic } from "./nic";
import { DISTRICTS } from "./reference";
export type MemberFilters = {
  q: string;
  type: string;
  district: string;
  status: string;
  school: string;
  ageCategory: string;
  from: string;
  to: string;
  page: number;
};
function date(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
    ? v
    : "";
}
export function memberFilters(
  input: Record<string, string | undefined>,
): MemberFilters {
  const get = (k: string, n = 120) =>
    String(input[k] ?? "")
      .trim()
      .slice(0, n);
  return {
    q: get("q"),
    type: ["coach", "athlete"].includes(get("type")) ? get("type") : "",
    district: (DISTRICTS as readonly string[]).includes(get("district"))
      ? get("district")
      : "",
    status: ["pending", "verified", "suspended", "merged"].includes(
      get("status"),
    )
      ? get("status")
      : "",
    school: get("school"),
    ageCategory: ["U14", "U16", "U18", "U20", "Senior", "Masters"].includes(
      get("ageCategory"),
    )
      ? get("ageCategory")
      : "",
    from: date(get("from")),
    to: date(get("to")),
    page: Math.min(100000, Math.max(1, parseInt(get("page"), 10) || 1)),
  };
}
export function memberWhere(s: MemberFilters) {
  const nic = s.q ? normalizeNic(s.q) : null;
  const ranges: Record<string, [number, number]> = {
    U14: [0, 13],
    U16: [14, 15],
    U18: [16, 17],
    U20: [18, 19],
    Senior: [20, 34],
    Masters: [35, 150],
  };
  const range = ranges[s.ageCategory];
  const like = (value: string) =>
    "%" + value.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
  return sql`WHERE TRUE
    ${s.type === "coach" ? sql`AND c.slaa_id IS NOT NULL` : sql``} ${s.type === "athlete" ? sql`AND a.slaa_id IS NOT NULL` : sql``}
    ${s.district ? sql`AND m.district=${s.district}` : sql``} ${s.status ? sql`AND m.status=${s.status}` : sql``}
    ${s.school ? sql`AND m.school_or_club ILIKE ${like(s.school)}` : sql``}
    ${range ? sql`AND date_part('year',age(now() AT TIME ZONE 'Asia/Colombo',m.date_of_birth)) BETWEEN ${range[0]} AND ${range[1]}` : sql``}
    ${s.from ? sql`AND m.created_at >= ${s.from + "T00:00:00+05:30"}::timestamptz` : sql``}
    ${s.to ? sql`AND m.created_at < ((${s.to}::date+1)::timestamp AT TIME ZONE 'Asia/Colombo')` : sql``}
    ${nic ? sql`AND m.nic=${nic}` : s.q ? sql`AND (m.slaa_id ILIKE ${s.q.replace(/[\\%_]/g, (c) => "\\" + c) + "%"} OR m.full_name ILIKE ${like(s.q)} OR m.name_with_initials ILIKE ${like(s.q)} OR m.postal_id=${s.q.toUpperCase()})` : sql``}`;
}
