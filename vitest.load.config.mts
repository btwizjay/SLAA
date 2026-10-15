import path from "node:path";
import { defineConfig } from "vitest/config";

// Opt-in, destructive tests: tests/support/db refuses a non-test database.
export default defineConfig({
  resolve: { alias: {
    "@": path.resolve(import.meta.dirname, "src"),
    "server-only": path.resolve(import.meta.dirname, "tests/support/empty.ts"),
  } },
  test: {
    environment: "node",
    include: ["tests/load/**/*.load.ts"],
    fileParallelism: false,
    testTimeout: 600000,
    hookTimeout: 30000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://slaa_app:devpass@localhost:5432/slaa_test",
      SESSION_SECRET: "load-test-only-secret",
      TURNSTILE_SECRET_KEY: "test",
      DB_POOL_MAX: "3",
      RATE_LIMIT_IDENTITY: "600",
      RATE_LIMIT_REGISTER: "600",
      RATE_LIMIT_SEARCH: "6000",
      RATE_LIMIT_SEARCH_SESSION: "60",
    },
  },
});
