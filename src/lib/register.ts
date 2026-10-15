import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { mapPgError } from "./errors";
import { hashIp, clientIp, rateLimit, readJson, requireTurnstile } from "./guard";
import { parseNic } from "./nic";
import { cleanText, flattenIssues, type Identity } from "./validation";

export const CONSENT_VERSION = process.env.CONSENT_VERSION ?? "2026-10-v1";

/**
 * Shared front half of the two registration routes: parse, rate limit,
 * Turnstile. Returns either the parsed body or the response to send.
 */
export async function parseRegistration<T extends { turnstileToken: string }>(
  req: Request,
  schema: ZodType<T>,
): Promise<{ data: T; ipHash: string; ip: string } | { response: NextResponse }> {
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) {
    const { message, fields } = flattenIssues(parsed.error);
    // the client form knows its fields without the "form." prefix
    for (const k of Object.keys(fields)) {
      if (k.startsWith("form.")) {
        fields[k.slice(5)] = fields[k];
        delete fields[k];
      }
    }
    return { response: NextResponse.json({ error: message, fields }, { status: 400 }) };
  }
  try {
    const limited = await rateLimit(req, "register");
    if (limited) return { response: limited };
    const failed = await requireTurnstile(req, parsed.data.turnstileToken);
    if (failed) return { response: failed };
    const ip = clientIp(req);
    return { data: parsed.data, ipHash: hashIp(ip), ip };
  } catch (e) {
    return { response: errorResponse(e, "registration checks") };
  }
}

/**
 * Date of birth and gender come from the NIC when one is given; the form
 * shows them locked, and the server does not trust the posted copy.
 */
export function personFromIdentity(
  identity: Identity,
  form: { dateOfBirth: string; gender: "M" | "F"; fullName: string; nameWithInitials: string },
) {
  let { dateOfBirth, gender } = form;
  if (identity.type === "nic") {
    const r = parseNic(identity.nic);
    if (r.ok) ({ dateOfBirth, gender } = r.info);
  }
  return {
    dateOfBirth,
    gender,
    fullName: cleanText(form.fullName),
    nameWithInitials: cleanText(form.nameWithInitials),
  };
}

export function errorResponse(e: unknown, what: string) {
  const mapped = mapPgError(e);
  if (mapped) {
    return NextResponse.json(
      { error: mapped.message, fields: mapped.field ? { [mapped.field]: mapped.message } : {} },
      { status: mapped.status },
    );
  }
  console.error(`${what} failed`, e);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
