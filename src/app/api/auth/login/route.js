import { z } from "zod";
import {
  checkCredentials,
  createSession,
  requireSameOrigin,
  sessionCookie,
} from "@/server/auth";
import { route, json, readJson } from "@/server/http";
import { parse } from "@/server/validation";
export const runtime = "nodejs";
export const POST = route(async (request) => {
  requireSameOrigin(request);
  const input = parse(
    z
      .object({
        username: z.string().min(1).max(256),
        password: z.string().min(1).max(1024),
      })
      .strict(),
    await readJson(request),
  );
  checkCredentials(input.username, input.password);
  return json({ ok: true }, 200, {
    "Set-Cookie": sessionCookie(request, createSession()),
  });
}, false);
