import "server-only";
import {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
} from "./crm-service.js";
import { route, json, readJson, expectedRevision } from "./http.js";

export function recordRoutes(kind) {
  return {
    list: route((request) => {
      const params = new URL(request.url).searchParams;
      const result = listRecords(kind, {
        q: params.get("q") || "",
        status: params.get("status"),
      });
      return json(result, 200, { ETag: `"${result.revision}"` });
    }),
    create: route(async (request) => {
      const result = createRecord(
        kind,
        await readJson(request),
        expectedRevision(request),
      );
      return json(result, 201, {
        Location: `/api/${kind}/${encodeURIComponent(result.data.id)}`,
        ETag: `"${result.revision}"`,
      });
    }),
    get: route(async (request, context) => {
      const { id } = await context.params;
      const result = getRecord(kind, id);
      return json(result, 200, { ETag: `"${result.revision}"` });
    }),
    update: route(async (request, context) => {
      const { id } = await context.params;
      const result = updateRecord(
        kind,
        id,
        await readJson(request),
        expectedRevision(request),
      );
      return json(result, 200, { ETag: `"${result.revision}"` });
    }),
    remove: route(async (request, context) => {
      const { id } = await context.params;
      return json(deleteRecord(kind, id, expectedRevision(request)));
    }),
  };
}
