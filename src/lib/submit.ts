"use client";

export type SubmitResult =
  | { ok: true; slaaId: string }
  | { ok: false; status: number; error: string; fields: Record<string, string> };

/** POST a registration and normalise the response for the form. */
export async function submitRegistration(url: string, body: unknown): Promise<SubmitResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, slaaId: data.slaaId };
    return {
      ok: false,
      status: res.status,
      error: data.error ?? "Something went wrong. Please try again.",
      fields: data.fields ?? {},
    };
  } catch {
    return { ok: false, status: 0, error: "Could not reach the server. Check your connection and try again.", fields: {} };
  }
}
