import { mergeContacts, mergeContactsInput } from "@/server/contact-merge";
import { expectedRevision, json, readJson, route } from "@/server/http";
import { parse } from "@/server/validation";

export const runtime = "nodejs";

export const POST = route(async (request) =>
  json(
    await mergeContacts(
      parse(mergeContactsInput, await readJson(request)),
      expectedRevision(request, true),
    ),
  ),
);
