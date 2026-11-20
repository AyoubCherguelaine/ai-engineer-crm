import "server-only";
import { randomUUID } from "node:crypto";
import { readWorkspace, mutateWorkspace } from "./database.js";
import {
  companyCreate,
  contactCreate,
  companyPatch,
  contactPatch,
  companyDefaults,
  contactDefaults,
  activityLog,
  parse,
} from "./validation.js";
import { addContactActivity } from "../lib/contact-activity.js";
import { ApiError } from "./errors.js";

function find(data, kind, id) {
  const record = data[kind].find((r) => r.id === id);
  if (!record) throw new ApiError(404, "Record not found.");
  return record;
}
export function listRecords(
  kind,
  { q = "", status, companyId, country, limit, offset = 0 } = {},
) {
  const { data, revision } = readWorkspace();
  const query = q.toLowerCase();
  const matches = data[kind].filter(
    (record) =>
      (!status || record.status === status) &&
      (!companyId || record.companyId === companyId) &&
      (!country || record.country?.toLowerCase() === country.toLowerCase()) &&
      [
        record.name,
        record.role,
        record.niche,
        record.country,
        record.description,
        record.email,
        record.linkedin,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
  );
  return {
    data: matches.slice(
      offset,
      limit === undefined ? undefined : offset + limit,
    ),
    total: matches.length,
    revision,
  };
}
export function getRecord(kind, id) {
  const { data, revision } = readWorkspace();
  return { data: find(data, kind, id), revision };
}
export function createRecord(kind, value, expectedRevision) {
  const input = parse(
    kind === "contacts" ? contactCreate : companyCreate,
    value,
  );
  const defaults = kind === "contacts" ? contactDefaults : companyDefaults;
  const record = {
    ...structuredClone(defaults),
    ...input,
    id: input.id || randomUUID(),
  };
  const result = mutateWorkspace((data) => {
    if (data[kind].some((r) => r.id === record.id))
      throw new ApiError(409, "A record with this ID already exists.");
    data[kind].unshift(record);
    return data;
  }, expectedRevision);
  return { data: record, revision: result.revision };
}
export function updateRecord(kind, id, value, expectedRevision) {
  const patch = parse(kind === "contacts" ? contactPatch : companyPatch, value);
  let record;
  const result = mutateWorkspace((data) => {
    record = { ...find(data, kind, id), ...patch };
    data[kind] = data[kind].map((r) => (r.id === id ? record : r));
    return data;
  }, expectedRevision);
  return { data: record, revision: result.revision };
}
export function deleteRecord(kind, id, expectedRevision) {
  const result = mutateWorkspace((data) => {
    find(data, kind, id);
    data[kind] = data[kind].filter((r) => r.id !== id);
    if (kind === "companies")
      data.contacts = data.contacts.map((c) =>
        c.companyId === id ? { ...c, companyId: "" } : c,
      );
    return data;
  }, expectedRevision);
  return { deleted: true, revision: result.revision };
}
export function logContactActivity(id, value, expectedRevision) {
  const activity = parse(activityLog, value);
  let record;
  const result = mutateWorkspace((data) => {
    record = addContactActivity(find(data, "contacts", id), activity);
    data.contacts = data.contacts.map((c) => (c.id === id ? record : c));
    return data;
  }, expectedRevision);
  return { data: record, revision: result.revision };
}
