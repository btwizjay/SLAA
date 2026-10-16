import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE, isLang } from "@/lib/i18n";

// 1. Public pages: the front page (/) is the language screen. A visitor who
//    lands deeper in the site without having chosen a language is sent there
//    first, then back to where they were going.
// Staff access is checked against the database on every protected page,
// action and API request, independently of this language middleware.
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/home" || pathname.startsWith("/register")) {
    if (isLang(request.cookies.get(LANG_COOKIE)?.value))
      return NextResponse.next();
    const to = new URL("/", request.url);
    to.searchParams.set("next", pathname + search);
    return NextResponse.redirect(to);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/home",
    "/register/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/auth/:path*",
  ],
};
