import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

export async function seedTestData(databaseUrl?: string) {
  const url =
    databaseUrl ||
    process.env.TEST_ADMIN_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres@localhost:5432/slaa_test";

  console.log("🌱 Seeding test data to:", url.replace(/:[^:@]+@/, ":***@"));

  const sql = postgres(url, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 3,
    onnotice: () => {},
  });

  try {
    const seedSqlPath = join(process.cwd(), "db", "seed_test_data.sql");
    const sqlContent = readFileSync(seedSqlPath, "utf8");

    await sql.unsafe(sqlContent);
    console.log("✅ Baseline coach (C26-000001-3 / 198532002937) seeded.");
    console.log("✅ Baseline athletes (A26-000101-1, A26-000102-9) seeded.");
    console.log("🎉 Test seed data applied successfully!");
    return true;
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      console.warn("⚠️  Database is offline or unreachable. Seed skipped for live DB.");
    } else {
      console.error("❌ Failed to apply seed data:", error.message);
    }
    return false;
  } finally {
    await sql.end().catch(() => {});
  }
}

// Execute directly if run via CLI
if (process.argv[1]?.endsWith("seed_test.ts")) {
  seedTestData().then(() => process.exit(0));
}

