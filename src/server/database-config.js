import { ApiError } from "./errors.js";

export function databaseConfig(env = process.env) {
  const url = env.TURSO_DATABASE_URL?.trim();
  const authToken = env.TURSO_AUTH_TOKEN?.trim();
  const remoteRequired =
    env.CRM_REQUIRE_TURSO === "true" ||
    env.NETLIFY === "true" ||
    Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
  if (url || authToken) {
    if (!url || !authToken)
      throw new ApiError(
        503,
        "Set both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to use the remote database.",
      );
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new ApiError(
        503,
        "TURSO_DATABASE_URL must be a valid libsql:// or https:// database URL.",
      );
    }
    const localHttp =
      !remoteRequired &&
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (!["libsql:", "https:"].includes(parsed.protocol) && !localHttp)
      throw new ApiError(
        503,
        "Turso requires a libsql:// or https:// URL. Local files and insecure remote URLs are not allowed.",
      );
    if (parsed.username || parsed.password || parsed.search || parsed.hash)
      throw new ApiError(
        503,
        "Use a Turso database URL without embedded credentials, query parameters, or fragments.",
      );
    return { mode: "turso", url, authToken };
  }
  if (remoteRequired)
    throw new ApiError(
      503,
      "This deployment requires Turso. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the hosting environment; local SQLite is disabled on serverless hosts.",
    );
  return { mode: "local", path: env.CRM_DB_PATH || "data/reach.sqlite" };
}
