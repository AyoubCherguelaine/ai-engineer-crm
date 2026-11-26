import "server-only";
import { createHash } from "node:crypto";
import { normalizeWorkspace } from "./validation.js";
import {
  initializeWorkspace,
  readStoredWorkspace,
  writeStoredWorkspace,
} from "./workspace-storage.js";
import { databaseConfig } from "./database-config.js";
import { ApiError } from "./errors.js";
import { newContactConflict } from "../lib/contact-matches.js";

const connections = (globalThis.__reachLibsqlConnections ??= new Map());
const conflict = () =>
  new ApiError(
    409,
    "The workspace changed in another tab or through the API. Export any unsaved changes, then reload to get the latest data.",
  );

export async function connectDatabase(config) {
  let client;
  try {
    if (config.mode === "turso") {
      // The web client uses HTTP only; no local file or native SQLite binding is opened.
      const { createClient } = await import("@libsql/client/web");
      client = createClient({
        url: config.url,
        authToken: config.authToken,
        intMode: "number",
      });
    } else {
      const [
        { createClient },
        { mkdir, chmod },
        { dirname, resolve },
        { pathToFileURL },
      ] = await Promise.all([
        import("@libsql/client/node"),
        import("node:fs/promises"),
        import("node:path"),
        import("node:url"),
      ]);
      const path = resolve(/* turbopackIgnore: true */ config.path);
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      client = createClient({
        url: pathToFileURL(path).href,
        intMode: "number",
      });
      await chmod(path, 0o600);
      await client.execute("PRAGMA journal_mode = WAL");
    }
    return client;
  } catch (error) {
    client?.close();
    throw error;
  }
}
async function openConnection(config) {
  const client = await connectDatabase(config);
  try {
    await initializeWorkspace(client);
    return client;
  } catch (error) {
    client.close();
    throw error;
  }
}
export async function database() {
  const config = databaseConfig();
  const key =
    config.mode === "turso"
      ? `turso:${config.url}:${createHash("sha256").update(config.authToken).digest("hex")}`
      : `local:${config.path}`;
  let pending = connections.get(key);
  if (!pending) {
    pending = openConnection(config);
    connections.set(key, pending);
  }
  try {
    return await pending;
  } catch (error) {
    if (connections.get(key) === pending) connections.delete(key);
    throw error;
  }
}
export async function readWorkspace() {
  return readStoredWorkspace(await database());
}

export async function mutateWorkspace(
  transform,
  expectedRevision,
  audit,
  { allowedContactDuplicates, undo } = {},
) {
  const client = await database();
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await readStoredWorkspace(client);
    if (expectedRevision !== undefined && expectedRevision !== current.revision)
      throw conflict();
    const data = normalizeWorkspace(transform(structuredClone(current.data)));
    const duplicates = newContactConflict(
      current.data.contacts,
      data.contacts,
      allowedContactDuplicates,
    );
    if (duplicates)
      throw new ApiError(
        409,
        `Contacts share an email address or LinkedIn profile. Review or merge the existing contacts: ${duplicates.join(", ")}.`,
      );
    const next = { data, revision: current.revision + 1, initialized: true };
    const change = audit?.(current.data, next.data);
    if (
      await writeStoredWorkspace(client, current, next, { audit: change, undo })
    )
      return next;
    if (expectedRevision !== undefined) throw conflict();
  }
  throw conflict();
}

export async function closeDatabases() {
  const pending = [...connections.values()];
  connections.clear();
  await Promise.all(
    pending.map(async (connection) => {
      try {
        (await connection).close();
      } catch {}
    }),
  );
}
