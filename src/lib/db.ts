import "server-only";
import postgres from "postgres";

// Dedicated clients per server instance for Coach and Athlete databases.
// On Vercel each function instance keeps a small pool; in production with Supabase
// transaction poolers (port 6543), prepared statements are not supported, hence prepare: false.

interface GlobalForDb {
  sqlCoach?: postgres.Sql;
  sqlAthlete?: postgres.Sql;
  sql?: postgres.Sql;
}

const globalForDb = globalThis as unknown as GlobalForDb;

function createClient(url: string | undefined, fallbackUrl: string | undefined) {
  // No connection is opened until the first query, so a missing URL only
  // fails at request time, not during `next build`.
  const connectionString = url || fallbackUrl || "";
  return postgres(connectionString, {
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idle_timeout: 20,
    prepare: false,
    connection: { search_path: "slaa,public" },
    onnotice: () => {},
  });
}

const coachUrl = process.env.COACH_DATABASE_URL || process.env.DATABASE_URL;
const athleteUrl = process.env.ATHLETE_DATABASE_URL || process.env.DATABASE_URL;

// Independent connection pool for the Coach Database
export const sqlCoach: postgres.Sql =
  globalForDb.sqlCoach ?? createClient(process.env.COACH_DATABASE_URL, process.env.DATABASE_URL);

// Independent connection pool for the Athlete Database
export const sqlAthlete: postgres.Sql =
  globalForDb.sqlAthlete ??
  (coachUrl && coachUrl === athleteUrl && globalForDb.sqlCoach
    ? globalForDb.sqlCoach
    : createClient(process.env.ATHLETE_DATABASE_URL, process.env.DATABASE_URL));

// Backward-compatible alias (defaults to sqlCoach)
export const sql: postgres.Sql = sqlCoach;

if (process.env.NODE_ENV !== "production") {
  globalForDb.sqlCoach = sqlCoach;
  globalForDb.sqlAthlete = sqlAthlete;
  globalForDb.sql = sql;
}
