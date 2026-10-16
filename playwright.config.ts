import { defineConfig, devices } from "@playwright/test";

// E2E runs against `next dev` on a separate port and the slaa_test database.
// Turnstile uses Cloudflare's always-pass test keys (needs internet access).
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  // Next dev compiles routes on first use; remote test databases add network latency.
  timeout: 90_000,
  expect: { timeout: 20_000 },
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["iPhone SE"],
    browserName: "chromium",
    viewport: { width: 375, height: 667 },
    trace: "retain-on-failure",
    // most tests start with English already chosen; language.spec.ts starts without it
    storageState: "tests/e2e/english.storage.json",
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgres://slaa_app:devpass@localhost:5432/slaa_test",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
      SESSION_SECRET: "e2e-secret",
      ADMIN_JWT_SECRET: "e2e-admin-jwt-secret-only-not-for-production-1234",
      RATE_LIMIT_IDENTITY: "1000",
      RATE_LIMIT_SEARCH: "1000",
      RATE_LIMIT_REGISTER: "1000",
      NEXT_DIST_DIR: ".next-e2e",
      // admin pages: dev-only sign-in bypass (next dev runs with NODE_ENV=development)
      DEV_ADMIN_EMAIL: "e2e-admin@localhost",
    },
  },
});
