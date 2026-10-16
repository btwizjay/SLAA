import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
export const ADMIN_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-slaa_admin" : "slaa_admin";
export const SESSION_SECONDS = 8 * 60 * 60;
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [version, salt, hash] = encoded.split("$");
  if (
    version !== "scrypt-v1" ||
    !/^[a-f0-9]{32}$/.test(salt ?? "") ||
    !/^[a-f0-9]{128}$/.test(hash ?? "")
  )
    return false;
  return timingSafeEqual(
    await derive(password, salt),
    Buffer.from(hash, "hex"),
  );
}
function key() {
  const value = process.env.ADMIN_JWT_SECRET;
  if (!value || value.length < 32)
    throw new Error("ADMIN_JWT_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(value);
}
export async function signAdminToken(staffId: string, sessionId: string) {
  return new SignJWT({ purpose: "staff" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(staffId)
    .setJti(sessionId)
    .setIssuer("slaa-admin")
    .setAudience("slaa-staff")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(key());
}
export async function readAdminToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      issuer: "slaa-admin",
      audience: "slaa-staff",
      maxTokenAge: `${SESSION_SECONDS}s`,
    });
    const uuid =
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (
      payload.purpose !== "staff" ||
      !payload.sub ||
      !payload.jti ||
      !uuid.test(payload.sub) ||
      !uuid.test(payload.jti)
    )
      return null;
    return { staffId: payload.sub, sessionId: payload.jti };
  } catch {
    return null;
  }
}
