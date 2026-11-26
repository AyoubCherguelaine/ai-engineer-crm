import { z } from "zod";
import { expectedRevision, json, route } from "@/server/http";
import { getMcpLog, undoMcpLog } from "@/server/mcp-audit";
import { parse } from "@/server/validation";

export const runtime = "nodejs";

const logId = z.coerce.number().int().positive();

export const GET = route(async (_request, { params }) =>
  json(await getMcpLog(parse(logId, (await params).id))),
);

export const POST = route(async (request, { params }) =>
  json(
    await undoMcpLog(
      parse(logId, (await params).id),
      expectedRevision(request, true),
    ),
  ),
);
