import "server-only";
import { database, mutateWorkspace } from "./database.js";
import { ApiError } from "./errors.js";
import { indexContacts } from "../lib/contact-matches.js";
import { readMcpLogDetail } from "./workspace-storage.js";

const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function auditRecords(tool, kind, ...ids) {
  if (!tool) return undefined;
  return (before, after) => {
    const changes = ids.map((recordId) => {
      const position = before[kind].findIndex(({ id }) => id === recordId);
      const previous = before[kind][position] ?? null;
      const next = after[kind].find(({ id }) => id === recordId) ?? null;
      const fields = Object.keys(next ?? previous ?? {}).filter(
        (key) => key !== "id" && !sameValue(previous?.[key], next?.[key]),
      );
      return {
        kind,
        recordId,
        position,
        fields,
        before:
          previous &&
          Object.fromEntries(fields.map((key) => [key, previous[key]])),
        after:
          next && Object.fromEntries(fields.map((key) => [key, next[key]])),
      };
    });
    if (tool === "merge_contacts") {
      // An undo may restore duplicate relationships that existed before the merge.
      const groups = indexContacts(before.contacts);
      changes[0].previousDuplicateGroups = [...groups]
        .filter(
          ([, members]) =>
            members.size > 1 && ids.some((id) => members.has(id)),
        )
        .map(([key, members]) => [key, [...members]]);
    }
    const fields = [...new Set(changes.flatMap((change) => change.fields))];
    return fields.length
      ? { tool, recordId: ids[0], fields, changes }
      : undefined;
  };
}

export async function getMcpLog(id) {
  const log = await readMcpLogDetail(await database(), id);
  if (!log) throw new ApiError(404, "This MCP entry is no longer in the log.");
  return log;
}

export async function undoMcpLog(id, revision) {
  const log = await getMcpLog(id);
  if (log.workspaceRevision !== revision)
    throw new ApiError(
      409,
      "The workspace changed. Reopen the edit before undoing it.",
    );
  if (!log.changes)
    throw new ApiError(409, "This older entry has no saved values to restore.");
  if (log.undoneRevision)
    throw new ApiError(409, "This edit was already undone.");
  if (log.superseded)
    throw new ApiError(
      409,
      "A later change affects this record. Review its current values before making another edit.",
    );

  const allowedContactDuplicates = new Map(
    (log.changes[0].previousDuplicateGroups ?? []).map(([key, ids]) => [
      key,
      new Set(ids),
    ]),
  );
  return mutateWorkspace(
    (data) => {
      for (const { kind, recordId, before, after, position } of log.changes) {
        const records = data[kind];
        const index = records.findIndex(({ id }) => id === recordId);
        const current = records[index];
        if (after === null) {
          if (current) throw new ApiError(409, "A newer record uses this ID.");
          records.splice(Math.min(position, records.length), 0, {
            id: recordId,
            ...before,
          });
          continue;
        }
        if (
          !current ||
          !Object.entries(after).every(([field, value]) =>
            sameValue(current[field], value),
          )
        )
          throw new ApiError(
            409,
            "The current values differ from the saved edit.",
          );
        if (before === null) {
          if (
            kind === "companies" &&
            data.contacts.some(({ companyId }) => companyId === recordId)
          )
            throw new ApiError(
              409,
              "Contacts are now linked to this company. Move them before undoing its creation.",
            );
          records.splice(index, 1);
        } else {
          records[index] = { ...current, ...before };
        }
      }
      return data;
    },
    revision,
    undefined,
    { allowedContactDuplicates, undo: id },
  );
}
