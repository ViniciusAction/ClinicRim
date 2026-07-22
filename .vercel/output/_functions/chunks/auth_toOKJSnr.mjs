import { timingSafeEqual, createHmac } from 'node:crypto';

const ADMIN_USER = "admin";
const ADMIN_PASSWORD = "rim2026";
const AUTH_SECRET = "dev-only-secret-clinica-rim";
const SESSION_COOKIE = "rim_admin_session";
const SESSION_MAX_AGE_S = 60 * 60 * 8;
function hmac(value) {
  return createHmac("sha256", AUTH_SECRET).update(value).digest();
}
function safeEqual(a, b) {
  return timingSafeEqual(hmac(`cmp:${a}`), hmac(`cmp:${b}`));
}
function checkCredentials(user, password) {
  return Boolean(Number(safeEqual(user, ADMIN_USER)) & Number(safeEqual(password, ADMIN_PASSWORD)));
}
function createSessionToken() {
  const expiresAt = Date.now() + SESSION_MAX_AGE_S * 1e3;
  const payload = Buffer.from(JSON.stringify({ user: ADMIN_USER, expiresAt })).toString(
    "base64url"
  );
  const signature = hmac(payload).toString("base64url");
  return `${payload}.${signature}`;
}
function verifySessionToken(token) {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = hmac(payload).toString("base64url");
  if (!safeEqual(signature, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof data.expiresAt === "number" && data.expiresAt > Date.now();
  } catch {
    return false;
  }
}
const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: true,
  maxAge: SESSION_MAX_AGE_S
};

export { SESSION_COOKIE as S, createSessionToken as a, checkCredentials as c, sessionCookieOptions as s, verifySessionToken as v };
