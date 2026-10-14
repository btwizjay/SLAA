import postgres from "postgres";

// Owner connection to the test database for resetting and inspecting state.
// (The app code under test connects as slaa_app via DATABASE_URL.)
export const admin = postgres(process.env.TEST_ADMIN_DATABASE_URL ?? "postgres://localhost:5432/slaa_test", {
  onnotice: () => {},
  connection: { search_path: "slaa,public" },
});

export async function resetDb() {
  await admin`
    TRUNCATE guardian, athlete_coach, coach_request, athlete, coach, member, audit_log, rate_limit
    RESTART IDENTITY CASCADE`;
  await admin`SELECT setval('coach_id_seq', 1, false), setval('athlete_id_seq', 1, false)`;
}
