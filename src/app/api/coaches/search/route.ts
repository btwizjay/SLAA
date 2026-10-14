import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { hasValidPass, rateLimit } from "@/lib/guard";
import { initialsName } from "@/lib/names";
import { DISTRICTS } from "@/lib/reference";

// Coach picker search. Returns name with initials, district and SLAA ID only:
// never phone, email, NIC, date of birth or full name.
export async function GET(req: Request) {
  if (!hasValidPass(req)) {
    return NextResponse.json(
      { error: "Your session has expired. Please start the registration again." },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  const district = url.searchParams.get("district") ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  if (q.length > 60) return NextResponse.json({ error: "Search text is too long." }, { status: 400 });
  if (district && !(DISTRICTS as readonly string[]).includes(district)) {
    return NextResponse.json({ error: "Unknown district." }, { status: 400 });
  }

  const limited = await rateLimit(req, "search");
  if (limited) return limited;

  const like = "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
  const rows = await sql<{ slaa_id: string; name_with_initials: string | null; full_name: string; district: string }[]>`
    SELECT m.slaa_id, m.name_with_initials, m.full_name, m.district
    FROM coach c JOIN member m USING (slaa_id)
    WHERE m.status IN ('pending', 'verified')
      AND (m.name_with_initials ILIKE ${like} OR m.full_name ILIKE ${like}
           OR m.slaa_id ILIKE ${q.toUpperCase() + "%"})
      AND (${district} = '' OR m.district = ${district})
    ORDER BY (m.district = ${district}) DESC, m.name_with_initials NULLS LAST, m.slaa_id
    LIMIT 20`;

  return NextResponse.json({
    results: rows.map((r) => ({
      slaaId: r.slaa_id,
      name: r.name_with_initials || initialsName(r.full_name),
      district: r.district,
    })),
  });
}
