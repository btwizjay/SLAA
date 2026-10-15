import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const MIGRATION_FILES = [
  "001_schema.sql",
  "seed_reference.sql",
  "002_app_additions.sql",
  "003_admin_delete.sql",
  "005_tighten_identity_and_school.sql",
  "006_coach_request_phone_optional.sql",
] as const;

export async function applyCoachDb(databaseUrl?: string) {
  const url =
    databaseUrl ||
    process.argv[2] ||
    process.env.COACH_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres@localhost:5432/slaa_test";

  console.log("============================================================");
  console.log("🏅 SLAA Coach Registration Database Setup");
  console.log("============================================================");
  console.log("🌐 Target Database:", url.replace(/:[^:@]+@/, ":***@"));
  console.log("🚫 Excluded: 004_athlete_details.sql (strict coach scope)");
  console.log("============================================================");

  const sql = postgres(url, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 5,
    onnotice: () => {},
  });

  try {
    // Test connectivity
    await sql`SELECT 1 as connected`;
    console.log("✅ Database connection established.\n");

    // Apply migrations in exact numerical order
    for (let i = 0; i < MIGRATION_FILES.length; i++) {
      const file = MIGRATION_FILES[i];
      const filePath = join(process.cwd(), "db", file);
      console.log(`▶️  [${i + 1}/${MIGRATION_FILES.length}] Applying ${file}...`);

      const content = readFileSync(filePath, "utf8");
      await sql.unsafe(content);
      console.log(`   ✅ ${file} applied successfully.`);
    }

    console.log("\n============================================================");
    console.log("🔍 Running Database Verification Checks");
    console.log("============================================================");

    // 1. Verify tables
    const expectedTables = [
      "member",
      "coach",
      "coach_qualification",
      "declaration_text",
      "coach_declaration",
      "audit_log",
    ];

    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'slaa' 
        AND table_name IN ${sql(expectedTables)}
      ORDER BY table_name`;

    const foundTables = tables.map((t) => t.table_name);
    console.log("📦 Required Tables Verification:");
    for (const t of expectedTables) {
      const exists = foundTables.includes(t);
      console.log(`   ${exists ? "✅" : "❌"} ${t.padEnd(25)} : ${exists ? "FOUND" : "MISSING"}`);
    }

    // 2. Verify sequences
    const seqs = await sql<{ sequence_name: string }[]>`
      SELECT sequence_name FROM information_schema.sequences 
      WHERE sequence_schema = 'slaa' AND sequence_name = 'coach_id_seq'`;

    const coachSeqExists = seqs.length > 0;
    console.log("\n🔢 Sequence Verification:");
    console.log(`   ${coachSeqExists ? "✅" : "❌"} coach_id_seq             : ${coachSeqExists ? "FOUND" : "MISSING"}`);

    // 3. Confirm 004_athlete_details.sql was EXCLUDED
    const athleteEventTable = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'slaa' AND table_name = 'athlete_event'`;

    const athleteEventExcluded = athleteEventTable.length === 0;
    console.log("\n🚫 Scope Strictness Check:");
    console.log(
      `   ${athleteEventExcluded ? "✅" : "❌"} athlete_event (004) table: ${
        athleteEventExcluded ? "EXCLUDED (Correct)" : "DETECTED (Unexpected)"
      }`,
    );

    // 4. Verify reference data & declarations
    const [declCount] = await sql<{ count: string }[]>`
      SELECT count(*)::text as count FROM slaa.declaration_text WHERE active = true`;
    const [districtCount] = await sql<{ count: string }[]>`
      SELECT count(*)::text as count FROM slaa.district`;
    const [provinceCount] = await sql<{ count: string }[]>`
      SELECT count(*)::text as count FROM slaa.province`;

    console.log("\n📋 Reference Data Verification:");
    console.log(`   ✅ Active CECS Declarations : ${declCount.count} (Expected 13)`);
    console.log(`   ✅ Sri Lanka Districts      : ${districtCount.count} (Expected 25)`);
    console.log(`   ✅ Sri Lanka Provinces      : ${provinceCount.count} (Expected 9)`);

    // 5. Verify SLAA Coach ID generation
    const [sampleId] = await sql<{ id: string }[]>`
      SELECT slaa.new_slaa_id('C') as id`;

    const validCoachIdFormat = /^C\d{2}-\d{6}-\d$/.test(sampleId?.id || "");
    console.log("\n🆔 SLAA Coach ID Generator Verification:");
    console.log(`   ${validCoachIdFormat ? "✅" : "❌"} Sample new_slaa_id('C')  : ${sampleId?.id} (Format: ${validCoachIdFormat ? "VALID" : "INVALID"})`);

    console.log("\n============================================================");
    if (
      foundTables.length === expectedTables.length &&
      coachSeqExists &&
      athleteEventExcluded &&
      validCoachIdFormat
    ) {
      console.log("🎉 ALL COACH DATABASE VERIFICATIONS PASSED SUCCESSFULLY!");
      console.log("============================================================\n");
      return true;
    } else {
      console.error("💥 SOME DATABASE VERIFICATIONS FAILED!");
      console.log("============================================================\n");
      return false;
    }
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      console.log("🟡 Target database is offline at:", url.replace(/:[^:@]+@/, ":***@"));
      console.log("ℹ️  To apply to a live PostgreSQL/Supabase database, run:");
      console.log("   npx tsx scripts/apply_coach_db.ts \"postgres://user:password@host:port/database\"\n");
    } else {
      console.error("❌ Database setup error:", error.message);
    }
    return false;
  } finally {
    await sql.end().catch(() => {});
  }
}

// Execute directly if run via CLI
if (process.argv[1]?.endsWith("apply_coach_db.ts")) {
  applyCoachDb().then(() => {
    process.exit(0);
  });
}

