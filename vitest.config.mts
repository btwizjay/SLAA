import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(
        import.meta.dirname,
        "tests/support/empty.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgres://slaa_app:devpass@localhost:5432/slaa_test",
      SESSION_SECRET: "test-secret",
      ADMIN_JWT_SECRET: "test-admin-jwt-secret-only-not-for-production-1234",
      TURNSTILE_SECRET_KEY: "test",
      RATE_LIMIT_IDENTITY: "1000",
      RATE_LIMIT_SEARCH: "1000",
      RATE_LIMIT_REGISTER: "1000",
    },
  },
});
