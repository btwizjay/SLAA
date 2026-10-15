import { afterEach, describe, expect, it, vi } from "vitest";

const { query, cancel } = vi.hoisted(() => ({ query: vi.fn(), cancel: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: query }));
const { GET } = await import("@/app/api/health/route");

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe("production readiness endpoint", () => {
  it("checks the database without caching its response", async () => {
    query.mockReturnValue(Promise.resolve([{ "?column?": 1 }]));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("reports an outage without exposing database exception details", async () => {
    query.mockReturnValue(Promise.reject(new Error("sensitive connection detail")));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "unavailable" });
  });

  it("cancels a stalled query after five seconds", async () => {
    vi.useFakeTimers();
    query.mockReturnValue(Object.assign(new Promise(() => {}), { cancel }));
    const pending = GET();
    await vi.advanceTimersByTimeAsync(5000);
    expect((await pending).status).toBe(503);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
