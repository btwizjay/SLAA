import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { mapPgError } from "@/lib/errors";
import { issuePass, rateLimit, readJson, requireTurnstile } from "@/lib/guard";
import { flattenIssues, identityCheckSchema, normalizeIdentity } from "@/lib/validation";

// Step 1 of registration. Returns only the masked record from
// find_existing_member_public(); never the unmasked lookup.
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
    const rows = await sql<{ slaa_id: string; masked_name: string; district: string }[]>`
      SELECT slaa_id, masked_name, district
      FROM find_existing_member_public(${id.nic}, ${id.postalId})
      LIMIT 1`;

    const res = rows.length
      ? NextResponse.json({
          exists: true,
          slaaId: rows[0].slaa_id,
          maskedName: rows[0].masked_name,
          district: rows[0].district,
        })
      : NextResponse.json({ exists: false });
    issuePass(res);
    return res;
  } catch (e) {
    const mapped = mapPgError(e);
    if (mapped) return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    console.error("identity-check failed", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
