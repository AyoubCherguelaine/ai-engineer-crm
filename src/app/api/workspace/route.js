import { readWorkspace, mutateWorkspace } from "@/server/database";
import { route, json, readJson, expectedRevision } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = route(async () => {
  const workspace = await readWorkspace();
  return json(workspace, 200, { ETag: `"${workspace.revision}"` });
});
export const PUT = route(async (request) => {
  const data = await readJson(request);
  return json(
    await mutateWorkspace(() => data, expectedRevision(request, true)),
  );
});
