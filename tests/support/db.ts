import postgres from "postgres";

// Owner connection to the test database for resetting and inspecting state.
// (The app code under test connects as slaa_app via DATABASE_URL or COACH_DATABASE_URL.)
const testUrl =
  process.env.TEST_ADMIN_DATABASE_URL ||
  process.env.COACH_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/slaa_test";

export const admin = postgres(testUrl, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 2,
  onnotice: () => {},
  connection: { search_path: "slaa,public" },
});

let dbOnline: boolean | null = null;

export async function isTestDbOnline(): Promise<boolean> {
  if (dbOnline !== null) return dbOnline;
  try {
    await admin`SELECT 1`;
    dbOnline = true;
  } catch {
    dbOnline = false;
  }
  return dbOnline;
}

export async function resetDb() {
  const online = await isTestDbOnline();
  if (!online) return;
  try {
    await admin`
      TRUNCATE guardian, athlete_coach, coach_request, athlete, coach, member, audit_log, rate_limit
      RESTART IDENTITY CASCADE`;
    await admin`SELECT setval('coach_id_seq', 1, false), setval('athlete_id_seq', 1, false)`;
  } catch (err) {
    console.warn("resetDb warning:", err);
  }
}
