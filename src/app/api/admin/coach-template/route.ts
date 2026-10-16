import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-auth";
import { COACH_CSV_COLUMNS } from "@/lib/coach-import";
export async function GET() {
  if (!(await getAdmin()))
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return new NextResponse("\uFEFF" + COACH_CSV_COLUMNS.join(",") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="slaa-coach-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
