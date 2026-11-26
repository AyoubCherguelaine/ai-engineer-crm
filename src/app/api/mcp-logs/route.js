import { z } from "zod";
import { database } from "@/server/database";
import { json, route } from "@/server/http";
import { parse } from "@/server/validation";
import { readMcpLogs } from "@/server/workspace-storage";

export const runtime = "nodejs";

const query = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  beforeId: z.coerce.number().int().positive().optional(),
});

export const GET = route(async (request) =>
  json(
    await readMcpLogs(
      await database(),
      parse(query, Object.fromEntries(new URL(request.url).searchParams)),
    ),
  ),
);
