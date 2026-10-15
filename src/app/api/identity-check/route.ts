import { NextResponse } from "next/server";
import { sqlCoach, sqlAthlete } from "@/lib/db";
import { mapPgError } from "@/lib/errors";
import { issuePass, rateLimit, readJson, requireTurnstile } from "@/lib/guard";
import { flattenIssues, identityCheckSchema, normalizeIdentity } from "@/lib/validation";

type ExistingMemberRow = { slaa_id: string; masked_name: string; district: string };

// Step 1 of registration. Queries both Coach and Athlete databases concurrently
// to enforce the Single-Person Rule across the entire ecosystem.
// Returns only the masked record from find_existing_member_public().
export async function POST(req: Request) {
  const parsed = identityCheckSchema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: flattenIssues(parsed.error).message }, { status: 400 });
  const { identity, turnstileToken } = parsed.data;

  const limited = await rateLimit(req, "identityCheck");
  if (limited) return limited;
  const failed = await requireTurnstile(req, turnstileToken);
  if (failed) return failed;

  const id = normalizeIdentity(identity);
  try {
    // Concurrently search both Coach DB and Athlete DB
    const [coachResult, athleteResult] = await Promise.allSettled([
      sqlCoach<ExistingMemberRow[]>`
        SELECT slaa_id, masked_name, district
        FROM find_existing_member_public(${id.nic}, ${id.postalId})
        LIMIT 1`,
      sqlAthlete<ExistingMemberRow[]>`
        SELECT slaa_id, masked_name, district
        FROM find_existing_member_public(${id.nic}, ${id.postalId})
        LIMIT 1`,
    ]);

    let match: ExistingMemberRow | null = null;

    if (coachResult.status === "fulfilled" && coachResult.value.length > 0) {
      match = coachResult.value[0];
    }

    if (!match && athleteResult.status === "fulfilled" && athleteResult.value.length > 0) {
      match = athleteResult.value[0];
    }

    // If both failed with rejection, throw error
    if (coachResult.status === "rejected" && athleteResult.status === "rejected") {
      throw coachResult.reason;
    }

    const res = match
      ? NextResponse.json({
          exists: true,
          slaaId: match.slaa_id,
          maskedName: match.masked_name,
          district: match.district,
        })
      : NextResponse.json({ exists: false });

    issuePass(res);
    return res;
  } catch (e) {
    const mapped = mapPgError(e);
    if (mapped) return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    if (process.env.NODE_ENV !== "production" && (e as { code?: string })?.code === "ECONNREFUSED") {
      console.warn("identity-check: DB unreachable in dev (ECONNREFUSED), proceeding with exists=false");
      const res = NextResponse.json({ exists: false });
      issuePass(res);
      return res;
    }
    console.error("identity-check failed", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
