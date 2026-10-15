import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-auth";
import { sqlCoach, sqlAthlete } from "@/lib/db";

// CSV export for SLAA staff. Every export is written to audit_log.

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join(" ") : String(v);
  // stop spreadsheets treating a value as a formula
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]) {
  const lines = [columns.join(",")];
  for (const r of rows) lines.push(columns.map((c) => cell(r[c])).join(","));
  return "\uFEFF" + lines.join("\r\n") + "\r\n"; // BOM so Excel reads UTF-8 names correctly
}

export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const type = new URL(req.url).searchParams.get("type") === "coaches" ? "coaches" : "members";

  try {
    let rows: Record<string, unknown>[] = [];
    let columns: string[] = [];

    if (type === "coaches") {
      const coachRows = await sqlCoach`
        SELECT m.slaa_id, m.full_name, m.name_with_initials, m.nic, m.postal_id, m.date_of_birth::text AS date_of_birth,
               m.gender, m.district, m.phone, m.email, m.status, c.slaa_license_no, c.license_level,
               c.disciplines, c.is_verified, m.created_at
        FROM member m JOIN coach c USING (slaa_id)
        WHERE m.status <> 'merged'
        ORDER BY m.slaa_id`;
      rows = coachRows as unknown as Record<string, unknown>[];
      columns = coachRows.columns.map((c) => c.name);
    } else {
      const [coachRows, athleteRows] = await Promise.all([
        sqlCoach`
          SELECT m.slaa_id, 'coach' AS type, m.full_name, m.name_with_initials, m.nic, m.postal_id,
                 m.date_of_birth::text AS date_of_birth, m.gender, m.district, m.phone, m.email, m.status,
                 m.merged_into, NULL AS school_or_club, NULL AS main_events, c.disciplines, m.created_at
          FROM member m JOIN coach c USING (slaa_id)
          WHERE m.status <> 'merged'`,
        sqlAthlete`
          SELECT m.slaa_id, 'athlete' AS type, m.full_name, m.name_with_initials, m.nic, m.postal_id,
                 m.date_of_birth::text AS date_of_birth, m.gender, m.district, m.phone, m.email, m.status,
                 m.merged_into, a.school_or_club, a.main_events, NULL AS disciplines, m.created_at
          FROM member m JOIN athlete a USING (slaa_id)
          WHERE m.status <> 'merged'`,
      ]);

      const all = [
        ...(coachRows as unknown as Record<string, unknown>[]),
        ...(athleteRows as unknown as Record<string, unknown>[]),
      ].sort((a, b) => String(a.slaa_id).localeCompare(String(b.slaa_id)));

      rows = all;
      columns = [
        "slaa_id", "type", "full_name", "name_with_initials", "nic", "postal_id",
        "date_of_birth", "gender", "district", "phone", "email", "status",
        "merged_into", "school_or_club", "main_events", "disciplines", "created_at"
      ];
    }

    try {
      await sqlCoach`
        INSERT INTO audit_log (actor, action, details)
        VALUES (${admin}, 'export', ${sqlCoach.json({ type, rows: rows.length })})`;
    } catch {
      // Non-fatal if audit logging fails
    }

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(toCsv(rows, columns), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="slaa-${type}-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production" && (err as { code?: string })?.code === "ECONNREFUSED") {
      return NextResponse.json({ error: "Database offline in dev" }, { status: 503 });
    }
    console.error("Export CSV error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
