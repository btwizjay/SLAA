import { NextResponse } from "next/server";
// Retired magic links no longer create sessions.
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/admin/login", request.url));
}
