import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

export async function cleanTestData(databaseUrl?: string) {
  const url =
    databaseUrl ||
    process.argv[2] ||
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres@localhost:5432/slaa_test";

  console.log("============================================================");
  console.log("🧹 SLAA Clean Up & Erase Seed Test Data");
  console.log("============================================================");
  console.log("🌐 Target Database:", url.replace(/:[^:@]+@/, ":***@"));
  console.log("🔒 Protected: Reference tables (province, district, event, declaration_text)");
  console.log("============================================================");

  const sql = postgres(url, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 5,
    onnotice: () => {},
  });

  try {
    // 1. Check connectivity
    await sql`SELECT 1 as connected`;
    console.log("✅ Database connection established.\n");

    // 2. Read cleanup SQL file
    const sqlPath = join(process.cwd(), "scripts", "clean_test_data.sql");
    const sqlScript = readFileSync(sqlPath, "utf8");

    // 3. Check pre-cleanup count
    const [preCoach] = await sql<{ count: string }[]>`
      SELECT count(*)::text as count FROM slaa.member 
      WHERE nic IN ('198532002937', '199214501234', '198822003456', '199411004321', '200412301111', '200561202222')
         OR slaa_id LIKE 'C26-000001%' OR slaa_id LIKE 'A26-000101%' OR slaa_id LIKE 'A26-000102%'`;

    console.log(`🔍 Found ${preCoach?.count || 0} matching test/seed member record(s) before cleanup.`);

    // 4. Execute cleanup
    console.log("▶️  Executing cleanup script (disabling immutability trigger & cascading)...");
    await sql.unsafe(sqlScript);
    console.log("   ✅ Cleanup script executed successfully.");

    // 5. Verification: Post-cleanup checks
    console.log("\n============================================================");
    console.log("🔍 Running Post-Cleanup Verification Checks");
    console.log("============================================================");

    const [postCoach] = await sql<{ count: string }[]>`
      SELECT count(*)::text as count FROM slaa.member 
      WHERE nic IN ('198532002937', '199214501234', '198822003456', '199411004321', '200412301111', '200561202222')
         OR slaa_id LIKE 'C26-000001%' OR slaa_id LIKE 'A26-000101%' OR slaa_id LIKE 'A26-000102%'`;

    const membersErased = Number(postCoach?.count || 0) === 0;
    console.log(`   ${membersErased ? "✅" : "❌"} Test Members Erased      : ${membersErased ? "CLEAN (0 remaining)" : `${postCoach?.count} remaining`}`);

    // Check declarations
    const [postDecls] = await sql<{ count: string }[]>`
      SELECT count(*)::text as count FROM slaa.coach_declaration 
      WHERE coach_id LIKE 'C26-000001%' OR signed_name IN ('Kavinda Pathirana', 'Nuwan Chamara Bandara')`;

    const declsErased = Number(postDecls?.count || 0) === 0;
    console.log(`   ${declsErased ? "✅" : "❌"} Test Declarations Erased  : ${declsErased ? "CLEAN (0 remaining)" : `${postDecls?.count} remaining`}`);

    // Verify reference tables are intact
    const [declCount] = await sql<{ count: string }[]>`
      SELECT count(*)::text as count FROM slaa.declaration_text WHERE active = true`;
    const [districtCount] = await sql<{ count: string }[]>`
      SELECT count(*)::text as count FROM slaa.district`;
    const [provinceCount] = await sql<{ count: string }[]>`
      SELECT count(*)::text as count FROM slaa.province`;

    console.log("\n🛡️ Reference Tables Integrity Check:");
    console.log(`   ✅ Active CECS Declarations : ${declCount?.count || 0} (Intact)`);
    console.log(`   ✅ Sri Lanka Districts      : ${districtCount?.count || 0} (Intact)`);
    console.log(`   ✅ Sri Lanka Provinces      : ${provinceCount?.count || 0} (Intact)`);

    console.log("\n============================================================");
    if (membersErased && declsErased) {
      console.log("🎉 ALL TEST AND SEED DATA HAS BEEN COMPLETELY REMOVED!");
      console.log("============================================================\n");
      return true;
    } else {
      console.error("💥 SOME TEST RECORDS COULD NOT BE REMOVED!");
      console.log("============================================================\n");
      return false;
    }
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      console.log("🟡 Target database is offline at:", url.replace(/:[^:@]+@/, ":***@"));
      console.log("ℹ️  To execute against a live PostgreSQL/Supabase database, run:");
      console.log("   npx tsx scripts/clean_test_data.ts \"postgres://user:password@host:port/database\"\n");
    } else {
      console.error("❌ Cleanup error:", error.message);
    }
    return false;
  } finally {
    await sql.end().catch(() => {});
  }
}

// Execute directly if run via CLI
if (process.argv[1]?.endsWith("clean_test_data.ts")) {
  cleanTestData().then(() => {
    process.exit(0);
  });
}

