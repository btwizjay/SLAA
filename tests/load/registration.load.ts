import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { afterAll, expect, it, vi } from "vitest";
import { admin, resetDb } from "../support/db";

// Only this test runner replaces CAPTCHA verification. No deployed bypass.
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: async () => true }));
const { POST: check } = await import("@/app/api/identity-check/route");
const { POST: register } = await import("@/app/api/register/athlete/route");
const { GET: search } = await import("@/app/api/coaches/search/route");
const { sql } = await import("@/lib/db");

afterAll(async () => { await sql.end(); await admin.end(); });

const ip = "203.0.113.25"; // All 500 applicants share one venue IP.
function request(body: unknown) {
  return new Request("https://test/api", { method: "POST", headers: {
    "content-type": "application/json", "x-forwarded-for": ip,
  }, body: JSON.stringify(body) });
}
function payload(index: number) {
  return {
    identity: { type: "nic", nic: `1995123${String(index).padStart(5, "0")}` },
    turnstileToken: "load-test-only",
    form: {
      fullName: `Synthetic Applicant ${index}`, nameWithInitials: `S. Applicant ${index}`,
      dateOfBirth: "1995-05-03", gender: "M", district: "Colombo", phone: "0712345678",
      schoolOrClub: "Synthetic Load Test Club", consent: true,
      events: ["100m", "200m", "400m"].map(code => ({ code, pb: "", pbYear: "", pbCompetition: "" })),
      guardian: null, coaches: [], unlistedCoaches: [],
    },
  };
}

it("registers 500 applicants at concurrency 50 from one IP with exact record counts", async () => {
  await resetDb();
  const latencies: number[] = [];
  const ids = new Set<string>();
  const cookies = new Set<string>();
  const failures: { index: number; step: string; status: number }[] = [];
  const started = performance.now();
  let next = 0;
  await Promise.all(Array.from({ length: 50 }, async () => {
    while (next < 500) {
      const index = next++;
      const body = payload(index);
      const start = performance.now();
      const identity = await check(request({ identity: body.identity, turnstileToken: body.turnstileToken }));
      if (identity.status !== 200) { failures.push({ index, step: "identity", status: identity.status }); continue; }
      const cookie = identity.headers.get("set-cookie")!.split(";")[0];
      cookies.add(cookie);
      // Three picker queries per applicant, exercising signed session + IP limits.
      for (let n = 0; n < 3; n++) {
        const response = await search(new Request("https://test/api/coaches/search?q=perera&near=Colombo", {
          headers: { cookie, "x-forwarded-for": ip },
        }));
        if (response.status !== 200) failures.push({ index, step: "search", status: response.status });
      }
      const response = await register(request(body));
      if (response.status === 201) {
        ids.add((await response.json()).slaaId);
        if (ids.size % 100 === 0) console.log(`Completed ${ids.size}/500 synthetic registrations`);
      }
      else failures.push({ index, step: "register", status: response.status });
      latencies.push(performance.now() - start);
    }
  }));
  const elapsedMs = Math.round(performance.now() - started);
  const [counts] = await admin`
    SELECT (SELECT count(*)::int FROM member) members,
           (SELECT count(*)::int FROM athlete) athletes,
           (SELECT count(*)::int FROM athlete_event) events,
           (SELECT count(*)::int FROM audit_log WHERE action = 'register_athlete') audits`;
  latencies.sort((a, b) => a - b);
  const report = {
    testedAt: new Date().toISOString(), applicants: 500, concurrency: 50, sharedIp: true,
    dbPoolMax: 3, elapsedMs, successful: ids.size, failures, counts,
    journeyMs: { p50: Math.round(latencies[Math.ceil(latencies.length * .5) - 1] ?? 0),
      p95: Math.round(latencies[Math.ceil(latencies.length * .95) - 1] ?? 0), max: Math.round(latencies.at(-1) ?? 0) },
    scope: "Real API handlers and isolated PostgreSQL database; CAPTCHA mocked. Excludes Vercel HTTP, browser rendering and real CAPTCHA.",
  };
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/load-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  expect(failures).toEqual([]);
  expect(ids.size).toBe(500);
  expect(cookies.size).toBe(500);
  expect(counts).toEqual({ members: 500, athletes: 500, events: 1500, audits: 500 });

  // A committed request whose response was lost must not create another member.
  const duplicate = await register(request(payload(0)));
  expect(duplicate.status).toBe(409);
  const recovered = await (await check(request({ identity: payload(0).identity, turnstileToken: "ok" }))).json();
  expect(recovered.exists).toBe(true);
  expect(ids.has(recovered.slaaId)).toBe(true);
  expect((await admin`SELECT count(*)::int n FROM member`)[0].n).toBe(500);

  // One browser is still throttled without blocking another on the same IP.
  const [first, second] = [...cookies];
  let lastStatus = 0;
  for (let n = 0; n < 61; n++) {
    lastStatus = (await search(new Request("https://test/api/coaches/search?q=perera", {
      headers: { cookie: first, "x-forwarded-for": ip },
    }))).status;
  }
  expect(lastStatus).toBe(429);
  expect((await search(new Request("https://test/api/coaches/search?q=perera", {
    headers: { cookie: second, "x-forwarded-for": ip },
  }))).status).toBe(200);
});
