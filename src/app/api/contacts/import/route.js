import {
  applyContactImport,
  contactImportInput,
  previewContactImport,
} from "@/server/contact-import";
import { expectedRevision, json, readJson, route } from "@/server/http";
import { parse } from "@/server/validation";

export const runtime = "nodejs";

export const POST = route(async (request) => {
  const { csv, apply } = parse(contactImportInput, await readJson(request));
  return json(
    apply
      ? await applyContactImport(csv, expectedRevision(request, true))
      : await previewContactImport(csv),
  );
});
