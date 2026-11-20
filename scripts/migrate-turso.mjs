import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { databaseConfig } from "../src/server/database-config.js";
import { database, closeDatabases } from "../src/server/database.js";
import {
  readLocalWorkspace,
  importIntoEmptyDatabase,
} from "../src/server/workspace-migration.js";

try {
  const config = databaseConfig();
  if (config.mode !== "turso")
    throw Error(
      "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env before migrating.",
    );
  const source = await readLocalWorkspace(
    process.argv[2] || process.env.CRM_DB_PATH || "data/reach.sqlite",
  );
  const backupDirectory = resolve("backups");
  await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
  const backupPath = join(
    backupDirectory,
    `reach-before-turso-${Date.now()}.json`,
  );
  await writeFile(backupPath, JSON.stringify(source.data, null, 2), {
    flag: "wx",
    mode: 0o600,
  });
  console.log("Source backup saved:", backupPath);
  const migrated = await importIntoEmptyDatabase(await database(), source);
  console.log(
    JSON.stringify(
      { migrated: true, ...migrated, backup: backupPath },
      null,
      2,
    ),
  );
} catch (error) {
  console.error("Turso migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeDatabases();
}
