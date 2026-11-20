import "server-only";
import { createHash } from "node:crypto";
import { emptyWorkspace, normalizeWorkspace } from "./validation.js";
import { databaseConfig } from "./database-config.js";
import { ApiError } from "./errors.js";

const connections = (globalThis.__reachLibsqlConnections ??= new Map());
const createTable =
  "CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, initialized INTEGER NOT NULL DEFAULT 0)";
const selectWorkspace =
  "SELECT data,revision,initialized FROM workspace WHERE id=1";
const conflict = () =>
  new ApiError(
    409,
    "The workspace changed in another tab or through the API. Export any unsaved changes, then reload to get the latest data.",
  );

export async function initializeWorkspace(client) {
  await client.batch(
    [
      createTable,
      {
        sql: "INSERT OR IGNORE INTO workspace(id,data) VALUES(1,?)",
        args: [JSON.stringify(emptyWorkspace())],
      },
    ],
    "write",
  );
}
async function openConnection(config) {
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
    // Idempotent and atomic when multiple function instances connect together.
    await initializeWorkspace(client);
    return client;
  } catch (error) {
    client?.close();
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
function decodeWorkspace(row) {
  if (!row) throw new Error("Workspace metadata is missing.");
  const revision = Number(row.revision);
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new Error("Invalid workspace revision.");
  return {
    data: normalizeWorkspace(JSON.parse(String(row.data))),
    revision,
    initialized: Boolean(Number(row.initialized)),
  };
}
export async function readWorkspace() {
  const client = await database();
  const result = await client.execute(selectWorkspace);
  return decodeWorkspace(result.rows[0]);
}
export async function mutateWorkspace(transform, expectedRevision) {
  const client = await database();
  // Compare-and-swap keeps a snapshot update atomic across independent serverless
  // instances without holding an interactive remote transaction across requests.
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = decodeWorkspace(
      (await client.execute(selectWorkspace)).rows[0],
    );
    if (expectedRevision !== undefined && expectedRevision !== current.revision)
      throw conflict();
    const data = normalizeWorkspace(transform(structuredClone(current.data)));
    const revision = current.revision + 1;
    const result = await client.execute({
      sql: "UPDATE workspace SET data=?,revision=?,initialized=1 WHERE id=1 AND revision=?",
      args: [JSON.stringify(data), revision, current.revision],
    });
    if (result.rowsAffected === 1) return { data, revision, initialized: true };
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
