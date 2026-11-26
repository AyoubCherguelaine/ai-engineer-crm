import { mkdir, writeFile, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { databaseConfig } from "../src/server/database-config.js";
import { connectDatabase } from "../src/server/database.js";
import {
  initializeWorkspace,
  readLegacyWorkspace,
  readStoredWorkspace,
} from "../src/server/workspace-storage.js";
import { normalizeWorkspace } from "../src/server/validation.js";
import { removeLegacySeedRecords } from "../src/lib/legacy-seed-cleanup.js";

let client;
try {
  const local = process.argv.slice(2).includes("--local");
  if (local) {
    // This explicit mode edits only the local file, leaving cloud configuration untouched.
    for (const key of [
      "TURSO_DATABASE_URL",
      "TURSO_AUTH_TOKEN",
      "NETLIFY",
      "AWS_LAMBDA_FUNCTION_NAME",
    ])
      delete process.env[key];
    process.env.CRM_REQUIRE_TURSO = "false";
    await access(resolve(process.env.CRM_DB_PATH || "data/reach.sqlite"));
  }
  const config = databaseConfig();
  client = await connectDatabase(config);
  const legacy = await readLegacyWorkspace(client);
  let backup;
  let removedContacts = 0;
  let removedCompanies = 0;
  if (legacy) {
    const original = legacy.data;
    const cleaned = removeLegacySeedRecords(original);
    normalizeWorkspace(cleaned);
    removedContacts = original.contacts.length - cleaned.contacts.length;
    removedCompanies = original.companies.length - cleaned.companies.length;
    if (removedContacts || removedCompanies || original.demo) {
      const backupDirectory = resolve("backups");
      await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
      backup = join(
        backupDirectory,
        `reach-before-seed-removal-${config.mode}-${Date.now()}-${randomUUID()}.json`,
      );
      await writeFile(backup, JSON.stringify(original, null, 2), {
        flag: "wx",
        mode: 0o600,
      });
    }
  }
  await initializeWorkspace(client);
  const workspace = await readStoredWorkspace(client);
  console.log(
    JSON.stringify(
      {
        storage: config.mode,
        removedContacts,
        removedCompanies,
        remainingContacts: workspace.data.contacts.length,
        remainingCompanies: workspace.data.companies.length,
        ...(backup
          ? { backup, revision: workspace.revision }
          : { unchanged: true }),
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error("Seed cleanup failed:", error.message);
  process.exitCode = 1;
} finally {
  client?.close();
}
