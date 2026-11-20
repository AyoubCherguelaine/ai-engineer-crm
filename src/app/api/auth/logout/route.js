import { requireSameOrigin, sessionCookie } from "@/server/auth";
import { route, json } from "@/server/http";
export const runtime = "nodejs";
export const POST = route((request) => {
  requireSameOrigin(request);
  return json({ ok: true }, 200, {
    "Set-Cookie": sessionCookie(request, "", 0),
  });
}, false);
