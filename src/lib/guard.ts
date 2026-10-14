import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sql } from "./db";
import { verifyTurnstile } from "./turnstile";

// Guards shared by the public API routes: client IP, per-IP rate limit,
// Turnstile, and a short-lived "passed the check" cookie for coach search
// (a search box cannot ask for a fresh Turnstile token on every keystroke).

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
  return s ?? "dev-only-secret";
}

/** IPs are hashed before they reach the database. */
export function hashIp(ip: string) {
  return createHash("sha256").update(secret() + ":" + ip).digest("hex").slice(0, 32);
}

export const LIMITS = {
  identityCheck: Number(process.env.RATE_LIMIT_IDENTITY ?? 10),
  search: Number(process.env.RATE_LIMIT_SEARCH ?? 10),
  register: Number(process.env.RATE_LIMIT_REGISTER ?? 10),
};

/** Returns a 429 response when over the limit, otherwise null. */
export async function rateLimit(req: Request, bucket: keyof typeof LIMITS): Promise<NextResponse | null> {
  const key = `${bucket}:${hashIp(clientIp(req))}`;
  const [row] = await sql<{ ok: boolean }[]>`
    SELECT rate_limit_hit(${key}, ${LIMITS[bucket]}, interval '1 minute') AS ok`;
  if (row.ok) return null;
  return NextResponse.json(
    { error: "Too many requests. Please wait a minute and try again." },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}

export async function requireTurnstile(req: Request, token: string): Promise<NextResponse | null> {
  if (await verifyTurnstile(token, clientIp(req))) return null;
  return NextResponse.json(
    { error: "The security check failed. Please refresh the page and try again." },
    { status: 403 },
  );
}

// --- signed cookie proving a recent Turnstile pass --------------------------

export const PASS_COOKIE = "slaa_pass";
const PASS_TTL_SECONDS = 60 * 60;

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function issuePass(res: NextResponse) {
  const exp = Math.floor(Date.now() / 1000) + PASS_TTL_SECONDS;
  const value = `${exp}.${sign(String(exp))}`;
  res.cookies.set(PASS_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api",
    maxAge: PASS_TTL_SECONDS,
  });
}

export function hasValidPass(req: Request): boolean {
  const raw = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(PASS_COOKIE + "="))
    ?.slice(PASS_COOKIE.length + 1);
  if (!raw) return false;
  const [exp, mac] = raw.split(".");
  if (!exp || !mac) return false;
  const expected = Buffer.from(sign(exp));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  return Number(exp) > Date.now() / 1000;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
