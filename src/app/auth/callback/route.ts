import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/admin-auth";

// Magic-link landing: exchange the one-time code for a session cookie.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/admin", url.origin));
  }
  return NextResponse.redirect(new URL("/admin/login?error=1", url.origin));
}
