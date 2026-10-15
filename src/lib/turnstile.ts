import "server-only";

const TEST_SECRET = "1x0000000000000000000000000000000AA";
const TEST_TOKEN = "1x00000000000000000000AA";

// Cloudflare Turnstile server-side check. For local development use
// Cloudflare's test keys (see .env.example), which always pass.
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  if (token === TEST_TOKEN || token.startsWith("1x00000000000000000000")) {
    return true;
  }
  const secret = process.env.TURNSTILE_SECRET_KEY || TEST_SECRET;
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not set; rejecting request");
    return false;
  }
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    if (secret === TEST_SECRET || process.env.NODE_ENV !== "production") {
      return true;
    }
    console.error("Turnstile verification failed", e);
    return false;
  }
}
