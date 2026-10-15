import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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

function positiveLimit(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
}

// A venue/carrier can put hundreds of applicants behind one IP. CAPTCHA
// remains mandatory for each identity check and registration. Search also
// has a smaller per-browser allowance, using the signed pass as its key.
export const LIMITS = {
  identityCheck: positiveLimit(process.env.RATE_LIMIT_IDENTITY, 600),
  search: positiveLimit(process.env.RATE_LIMIT_SEARCH, 6000),
  register: positiveLimit(process.env.RATE_LIMIT_REGISTER, 600),
};
const SEARCH_SESSION_LIMIT = positiveLimit(process.env.RATE_LIMIT_SEARCH_SESSION, 60);

/** Returns a 429 response when over the limit, otherwise null. */
export async function rateLimit(req: Request, bucket: keyof typeof LIMITS): Promise<NextResponse | null> {
  const key = `${bucket}:${hashIp(clientIp(req))}`;
  const pass = bucket === "search" ? validPass(req) : null;
  const [row] = pass
    ? await sql<{ ok: boolean }[]>`
        SELECT rate_limit_hit(${key}, ${LIMITS[bucket]}, interval '1 minute')
          AND rate_limit_hit(${"searchSession:" + hashIp(pass)}, ${SEARCH_SESSION_LIMIT}, interval '1 minute') AS ok`
    : await sql<{ ok: boolean }[]>`
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
  const payload = `${exp}.${randomBytes(16).toString("base64url")}`;
  const value = `${payload}.${sign(payload)}`;
  res.cookies.set(PASS_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api",
    maxAge: PASS_TTL_SECONDS,
  });
}

export function hasValidPass(req: Request): boolean {
  return validPass(req) !== null;
}

function validPass(req: Request): string | null {
  const raw = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(PASS_COOKIE + "="))
    ?.slice(PASS_COOKIE.length + 1);
  if (!raw) return null;
  const parts = raw.split(".");
  // Two-part passes from the previous deployment remain valid until expiry.
  if (parts.length !== 2 && parts.length !== 3) return null;
  const exp = Number(parts[0]);
  if (!Number.isSafeInteger(exp) || exp <= Date.now() / 1000) return null;
  const mac = parts.at(-1)!;
  const expected = Buffer.from(sign(parts.slice(0, -1).join(".")));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return raw;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
