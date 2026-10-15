import postgres from "postgres";

// Owner connection to the test database for resetting and inspecting state.
// (The app code under test connects as slaa_app via DATABASE_URL.)
const adminUrl = process.env.TEST_ADMIN_DATABASE_URL ?? "postgres://localhost:5432/slaa_test";
const database = new URL(adminUrl).pathname.slice(1);
if (!/(?:^|_)test(?:_|$)/i.test(database)) {
  throw new Error("Tests require a separate database with 'test' in its name; refusing to reset this database.");
}
if (process.env.TEST_DATABASE_URL) {
  const app = new URL(process.env.TEST_DATABASE_URL);
  if (app.pathname.slice(1) !== database) throw new Error("Test app and admin connections must use the same database.");
}
export const admin = postgres(adminUrl, {
  onnotice: () => {},
  connection: { search_path: "slaa,public" },
});

export async function resetDb() {
  await admin`
    TRUNCATE guardian, athlete_coach, coach_request, athlete, coach, member, audit_log, rate_limit
    RESTART IDENTITY CASCADE`;
  await admin`SELECT setval('coach_id_seq', 1, false), setval('athlete_id_seq', 1, false)`;
}
