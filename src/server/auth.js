import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "./errors.js";

export const SESSION_COOKIE = "reach_session";
export const SESSION_SECONDS = 8 * 60 * 60;
const failures = (globalThis.__reachAuthFailures ??= { count: 0, resetAt: 0 });

export function authConfigured() {
  return Boolean(
    process.env.CRM_USERNAME &&
    process.env.CRM_PASSWORD &&
    process.env.SESSION_SECRET?.length >= 32,
  );
}
function configuration() {
  if (!authConfigured())
    throw new ApiError(
      503,
      "Login is not configured. Set CRM_USERNAME, CRM_PASSWORD and SESSION_SECRET (at least 32 characters) in .env.",
    );
  return {
    username: process.env.CRM_USERNAME,
    password: process.env.CRM_PASSWORD,
    secret: process.env.SESSION_SECRET,
  };
}
function equal(a, b) {
  const hash = (value) => createHash("sha256").update(String(value)).digest();
  return timingSafeEqual(hash(a), hash(b));
}
export function checkCredentials(username, password) {
  const config = configuration();
  if (Date.now() >= failures.resetAt)
    Object.assign(failures, { count: 0, resetAt: Date.now() + 15 * 60 * 1000 });
  if (failures.count >= 10)
    throw new ApiError(
      429,
      "Too many failed login attempts. Try again in 15 minutes.",
    );
  const validUser = equal(username, config.username);
  const validPassword = equal(password, config.password);
  if (!validUser || !validPassword) {
    failures.count += 1;
    throw new ApiError(401, "Invalid username or password.");
  }
  failures.count = 0;
  return true;
}
function signature(payload) {
  const config = configuration();
  return createHmac("sha256", config.secret)
    .update(`${config.username}\0${config.password}\0${payload}`)
    .digest("base64url");
}
export function createSession(now = Date.now()) {
  const config = configuration();
  const payload = Buffer.from(
    JSON.stringify({
      user: config.username,
      exp: Math.floor(now / 1000) + SESSION_SECONDS,
    }),
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function verifySession(token, now = Date.now()) {
  if (!authConfigured() || typeof token !== "string" || token.length > 2048)
    return false;
  try {
    const [payload, supplied, extra] = token.split(".");
    if (!payload || !supplied || extra || !equal(supplied, signature(payload)))
      return false;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (
      session.user === process.env.CRM_USERNAME &&
      Number.isSafeInteger(session.exp) &&
      session.exp > Math.floor(now / 1000)
    );
  } catch {
    return false;
  }
}
export function requireSameOrigin(request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  // Browsers set this forbidden header using the public URL, before a preview
  // or reverse proxy rewrites Host. Scripts on other sites cannot forge it.
  if (site === "cross-site" || origin === "null")
    throw new ApiError(403, "Cross-origin requests are not allowed.");
  if (site === "same-origin") return;
  // Next may construct request.url with an internal hostname. Compare against
  // the incoming host/protocol (or the reverse proxy's forwarded values).
  const url = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
    request.headers.get("host") ||
    url.host;
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    url.protocol.slice(0, -1);
  if (origin && origin !== `${protocol}://${host}`)
    throw new ApiError(403, "Cross-origin requests are not allowed.");
}
export function requireBearerToken(request) {
  const configured = process.env.CRM_API_TOKEN;
  if (!configured || configured.length < 32)
    throw new ApiError(
      503,
      "Token access is not configured. Set CRM_API_TOKEN to at least 32 random characters in .env.",
    );
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  if (!match || header.length > 4096 || !equal(match[1], configured))
    throw new ApiError(401, "A valid CRM API bearer token is required.");
}
export function requireApiAuth(request) {
  const tokenHeader = request.headers.get("authorization");
  if (tokenHeader && /^Bearer\s/i.test(tokenHeader)) {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method))
      requireSameOrigin(request);
    requireBearerToken(request);
    return;
  }
  configuration();
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method))
    requireSameOrigin(request);
  const authorization = request.headers.get("authorization");
  if (authorization) {
    if (!authorization.startsWith("Basic ") || authorization.length > 4096)
      throw new ApiError(
        401,
        "Use HTTP Basic authentication with your CRM username and password.",
      );
    const decoded = Buffer.from(authorization.slice(6), "base64").toString();
    const separator = decoded.indexOf(":");
    if (separator < 0)
      throw new ApiError(401, "Invalid HTTP Basic credentials.");
    checkCredentials(decoded.slice(0, separator), decoded.slice(separator + 1));
    return;
  }
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!verifySession(cookie))
    throw new ApiError(401, "Sign in or supply HTTP Basic credentials.");
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method))
    requireSameOrigin(request);
}
export function sessionCookie(request, token, maxAge = SESSION_SECONDS) {
  const secure =
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
