import "server-only";
import Database from "better-sqlite3";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { emptyWorkspace, normalizeWorkspace } from "./validation.js";
import { ApiError } from "./errors.js";

const instances = (globalThis.__reachDatabases ??= new Map());
export function database() {
  // Runtime data lives on disk and must not be included in Next's output tracing.
  const path = resolve(
    /* turbopackIgnore: true */ process.env.CRM_DB_PATH || "data/reach.sqlite",
  );
  if (instances.has(path)) return instances.get(path);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new Database(path, { timeout: 5000 });
  chmodSync(path, 0o600);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.exec(
    "CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, initialized INTEGER NOT NULL DEFAULT 0)",
  );
  db.prepare("INSERT OR IGNORE INTO workspace(id,data) VALUES(1,?)").run(
    JSON.stringify(emptyWorkspace()),
  );
  instances.set(path, db);
  return db;
}
export function readWorkspace() {
  const row = database().prepare("SELECT * FROM workspace WHERE id=1").get();
  return {
    data: normalizeWorkspace(JSON.parse(row.data)),
    revision: row.revision,
    initialized: Boolean(row.initialized),
  };
}
export function mutateWorkspace(transform, expectedRevision) {
  const db = database();
  return db
    .transaction(() => {
      const current = readWorkspace();
      if (
        expectedRevision !== undefined &&
        expectedRevision !== current.revision
      )
        throw new ApiError(
          409,
          "The workspace changed in another tab or through the API. Export any unsaved changes, then reload to get the latest data.",
        );
      const data = normalizeWorkspace(transform(structuredClone(current.data)));
      const revision = current.revision + 1;
      db.prepare(
        "UPDATE workspace SET data=?,revision=?,initialized=1 WHERE id=1",
      ).run(JSON.stringify(data), revision);
      return { data, revision, initialized: true };
    })
    .immediate();
}
