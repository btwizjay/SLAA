import { afterEach, describe, expect, it, vi } from "vitest";
import { submitRegistration } from "@/lib/submit";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("submission recovery", () => {
  it("accepts only a valid ID in a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ slaaId: "A26-000123-4" }, { status: 201 })));
    expect(await submitRegistration("/api/register/athlete", {})).toEqual({ ok: true, slaaId: "A26-000123-4" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));
    expect(await submitRegistration("/api/register/athlete", {})).toMatchObject({ ok: false, status: 0 });
  });

  it("keeps duplicate responses distinct for the ID recovery link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "This ID is already registered." }, { status: 409 })));
    expect(await submitRegistration("/api/register/athlete", {})).toMatchObject({ ok: false, status: 409 });
  });

  it("bounds a slow request and preserves an ambiguous outcome for recovery", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, options) => {
      expect(options.signal).toBeInstanceOf(AbortSignal);
      return new Promise((_, reject) => {
        options.signal.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")));
      });
    }));
    const pending = submitRegistration("/api/register/athlete", {});
    await vi.advanceTimersByTimeAsync(45000);
    expect(await pending).toMatchObject({ ok: false, status: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });
});
