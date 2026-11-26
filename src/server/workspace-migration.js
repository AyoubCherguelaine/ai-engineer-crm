import "server-only";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client/node";
import { normalizeWorkspace } from "./validation.js";
import {
  initializeWorkspace,
  readLegacyWorkspace,
  readStoredWorkspace,
  writeStoredWorkspace,
} from "./workspace-storage.js";
import { ApiError } from "./errors.js";

export async function readLocalWorkspace(sourcePath) {
  const path = resolve(sourcePath);
  await access(path);
  const client = createClient({
    url: pathToFileURL(path).href,
    intMode: "number",
  });
  try {
    const snapshot =
      (await readLegacyWorkspace(client)) ??
      (await readStoredWorkspace(client));
    return { ...snapshot, data: normalizeWorkspace(snapshot.data) };
  } finally {
    client.close();
  }
}

export async function importIntoEmptyDatabase(client, source) {
  const data = normalizeWorkspace(source.data);
  await initializeWorkspace(client);
  const current = await readStoredWorkspace(client);
  if (
    current.initialized ||
    current.data.contacts.length ||
    current.data.companies.length
  )
    throw new ApiError(
      409,
      "The destination already has an initialized workspace. Migration refuses to overwrite it.",
    );

  const revision = Math.max(current.revision, source.revision) + 1;
  if (
    !(await writeStoredWorkspace(client, current, {
      data,
      revision,
      initialized: true,
    }))
  )
    throw new ApiError(
      409,
      "The destination changed during migration. Nothing was overwritten.",
    );

  const verified = await readStoredWorkspace(client);
  if (
    JSON.stringify(normalizeWorkspace(verified.data)) !== JSON.stringify(data)
  )
    throw new ApiError(
      409,
      "The destination changed after migration. Check the backup and destination before continuing.",
    );

  return {
    revision: verified.revision,
    contacts: data.contacts.length,
    companies: data.companies.length,
  };
}
