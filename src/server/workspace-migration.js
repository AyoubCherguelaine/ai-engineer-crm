import "server-only";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client/node";
import { normalizeWorkspace } from "./validation.js";
import { initializeWorkspace } from "./database.js";
import { ApiError } from "./errors.js";

export async function readLocalWorkspace(sourcePath) {
  const path = resolve(sourcePath);
  await access(path);
  const client = createClient({
    url: pathToFileURL(path).href,
    intMode: "number",
  });
  try {
    const row = (
      await client.execute(
        "SELECT data,revision,initialized FROM workspace WHERE id=1",
      )
    ).rows[0];
    if (!row)
      throw new ApiError(
        422,
        "The local database does not contain a Reach workspace.",
      );
    const revision = Number(row.revision);
    if (!Number.isSafeInteger(revision) || revision < 0)
      throw new ApiError(422, "Invalid source workspace revision.");
    return {
      data: normalizeWorkspace(JSON.parse(String(row.data))),
      revision,
      initialized: Boolean(Number(row.initialized)),
    };
  } finally {
    client.close();
  }
}
export async function importIntoEmptyDatabase(client, source) {
  const data = normalizeWorkspace(source.data);
  await initializeWorkspace(client);
  const row = (
    await client.execute(
      "SELECT data,revision,initialized FROM workspace WHERE id=1",
    )
  ).rows[0];
  const existing = normalizeWorkspace(JSON.parse(String(row.data)));
  if (
    Number(row.initialized) !== 0 ||
    existing.contacts.length ||
    existing.companies.length
  )
    throw new ApiError(
      409,
      "The destination already has an initialized workspace. Migration refuses to overwrite it.",
    );
  const revision = Math.max(Number(row.revision), source.revision) + 1;
  const result = await client.execute({
    sql: "UPDATE workspace SET data=?,revision=?,initialized=1 WHERE id=1 AND initialized=0 AND revision=?",
    args: [JSON.stringify(data), revision, Number(row.revision)],
  });
  if (result.rowsAffected !== 1)
    throw new ApiError(
      409,
      "The destination changed during migration. Nothing was overwritten.",
    );
  const verified = (
    await client.execute("SELECT data,revision FROM workspace WHERE id=1")
  ).rows[0];
  if (
    JSON.stringify(normalizeWorkspace(JSON.parse(String(verified.data)))) !==
    JSON.stringify(data)
  )
    throw new ApiError(
      409,
      "The destination changed after migration. Check the backup and destination before continuing.",
    );
  return {
    revision: Number(verified.revision),
    contacts: data.contacts.length,
    companies: data.companies.length,
  };
}
