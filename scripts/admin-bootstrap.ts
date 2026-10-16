import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import postgres from "postgres";
import { hashPassword } from "../src/lib/admin-session";

// Run with an owner connection after applying migration 007. No credentials
// are logged; initial credentials stay in the ignored local environment file.
const filename = ".env.local";
let text = readFileSync(filename, "utf8");
const local = parseEnv(text);
const email = (
  process.env.ADMIN_OWNER_EMAIL ??
  local.ADMIN_OWNER_EMAIL ??
  "ceo@ascendit.dev"
)
  .trim()
  .toLowerCase();
const secret = local.ADMIN_JWT_SECRET || randomBytes(48).toString("base64url");
const password =
  local.ADMIN_INITIAL_PASSWORD || randomBytes(24).toString("base64url");
if (
  secret.length < 32 ||
  password.length < 12 ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
)
  throw new Error("Invalid owner bootstrap settings");
const url = process.env.BOOTSTRAP_DATABASE_URL ?? local.DATABASE_URL_UNPOOLED;
if (!url) throw new Error("An owner database connection is required");
const sql = postgres(url, {
  max: 1,
  prepare: false,
  onnotice: () => {},
  connection: { search_path: "slaa,public" },
});
async function main() {
  try {
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(719001)`;
      const existing =
        await tx`SELECT email FROM admin_staff WHERE role='owner'`;
      if (existing.length && !existing.some((s) => s.email === email))
        throw new Error("An owner already exists; refusing to add another");
      if (!existing.length) {
        await tx`INSERT INTO admin_staff(email,password_hash,role) VALUES(${email},${await hashPassword(password)},'owner')`;
        await tx`INSERT INTO audit_log(actor,action) VALUES(${email},'owner_bootstrapped')`;
      } else if (process.argv.includes("--reset-password")) {
        const [owner] =
          await tx`UPDATE admin_staff SET password_hash=${await hashPassword(password)},must_change_password=true,active=true WHERE email=${email} AND role='owner' RETURNING id`;
        await tx`UPDATE admin_session SET revoked_at=now() WHERE staff_id=${owner.id} AND revoked_at IS NULL`;
        await tx`INSERT INTO audit_log(actor,action) VALUES(${email},'owner_password_reset')`;
      }
    });
    for (const [key, value] of Object.entries({
      ADMIN_OWNER_EMAIL: email,
      ADMIN_JWT_SECRET: secret,
      ADMIN_INITIAL_PASSWORD: password,
    })) {
      const pattern = new RegExp("^" + key + "=.*$", "m");
      text = pattern.test(text)
        ? text.replace(pattern, key + "=" + value)
        : text + "\n" + key + "=" + value + "\n";
    }
    writeFileSync(filename, text);
    console.log(
      `Owner account ready for ${email}. Initial password is stored in .env.local as ADMIN_INITIAL_PASSWORD. ${process.argv.includes("--reset-password") ? "Password reset requested; existing sessions revoked." : "No existing password was replaced."}`,
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
}
main().catch((error) => {
  console.error(
    error.code
      ? "Owner setup failed; check database access and migrations."
      : error.message,
  );
  process.exitCode = 1;
});
