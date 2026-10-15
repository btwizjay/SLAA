import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// No account details, database metadata or exception text leave this endpoint.
export async function GET() {
  const query = sql`SELECT 1`;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      query,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          query.cancel();
          reject(new Error("Health check timeout"));
        }, 5000);
      }),
    ]);
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "30" },
    });
  } finally {
    clearTimeout(timer);
  }
}
