import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { mutateWorkspace } from "./database.js";
import { ApiError } from "./errors.js";
import { recordId } from "./validation.js";
import { auditRecords } from "./mcp-audit.js";
import { indexContacts, contactKeys } from "../lib/contact-matches.js";

export const mergeContactsInput = z
  .object({ keepId: recordId, mergeId: recordId })
  .strict();

export async function mergeContacts({ keepId, mergeId }, revision, tool) {
  if (keepId === mergeId)
    throw new ApiError(422, "Choose two different contacts.");
  const allowedContactDuplicates = new Map();
  return mutateWorkspace(
    (data) => {
      const keep = data.contacts.find(({ id }) => id === keepId);
      const source = data.contacts.find(({ id }) => id === mergeId);
      if (!keep || !source)
        throw new ApiError(404, "One of the contacts could not be found.");

      const merged = { ...keep };
      for (const key of Object.keys(keep)) {
        if (keep[key] === "") merged[key] = source[key];
      }
      if (keep.notes && source.notes && keep.notes !== source.notes)
        merged.notes = [keep.notes, source.notes].join("\n\n");
      for (const field of ["lastContact", "replyDate"])
        if (source[field] > merged[field]) merged[field] = source[field];

      const activities = new Map(
        keep.activities.map((activity) => [activity.id, activity]),
      );
      for (const activity of source.activities) {
        const existing = activities.get(activity.id);
        if (!existing) activities.set(activity.id, activity);
        else if (JSON.stringify(existing) !== JSON.stringify(activity)) {
          const id = randomUUID();
          activities.set(id, { ...activity, id });
        }
      }
      merged.activities = [...activities.values()].sort((a, b) =>
        b.date.localeCompare(a.date),
      );
      const identities = indexContacts(data.contacts);
      for (const key of contactKeys(merged)) {
        const owners = identities.get(key);
        if (owners?.has(mergeId))
          allowedContactDuplicates.set(key, new Set([...owners, keepId]));
      }
      data.contacts = data.contacts
        .filter(({ id }) => id !== mergeId)
        .map((contact) => (contact.id === keepId ? merged : contact));
      return data;
    },
    revision,
    auditRecords(tool, "contacts", keepId, mergeId),
    { allowedContactDuplicates },
  );
}
