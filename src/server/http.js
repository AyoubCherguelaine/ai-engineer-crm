import "server-only";
import { requireApiAuth } from "./auth.js";
import { ApiError } from "./errors.js";

export function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
export function route(handler, authenticated = true) {
  return async (request, context) => {
    try {
      if (authenticated) requireApiAuth(request);
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError)
        return json(
          { error: error.message },
          error.status,
          error.status === 429 ? { "Retry-After": "900" } : {},
        );
      console.error(
        "CRM request failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
      return json(
        { error: "The server could not complete this request." },
        500,
      );
    }
  };
}
export async function readJson(request) {
  if (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() !== "application/json"
  )
    throw new ApiError(415, "Send an application/json request body.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "A JSON request body is required.");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 5 * 1024 * 1024) {
        await reader.cancel();
        throw new ApiError(413, "Request body must be smaller than 5 MB.");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "Invalid JSON request body.");
  }
}
export function expectedRevision(request, required = false) {
  const value = request.headers.get("if-match");
  if (value === null) {
    if (required)
      throw new ApiError(
        428,
        "Supply the workspace revision in the If-Match header.",
      );
    return undefined;
  }
  const match = /^(?:"(\d+)"|(\d+))$/.exec(value);
  const revision = match ? Number(match[1] ?? match[2]) : NaN;
  if (!Number.isSafeInteger(revision))
    throw new ApiError(400, "Invalid If-Match revision.");
  return revision;
}
