import { mkdir, writeFile, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { databaseConfig } from "../src/server/database-config.js";
import { database, closeDatabases } from "../src/server/database.js";
import { normalizeWorkspace } from "../src/server/validation.js";
import { removeLegacySeedRecords } from "../src/lib/legacy-seed-cleanup.js";

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
  const client = await database();
  let complete = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = (
      await client.execute("SELECT data,revision FROM workspace WHERE id=1")
    ).rows[0];
    if (!row) throw Error("Workspace not found.");
    const original = JSON.parse(String(row.data));
    const cleaned = removeLegacySeedRecords(original);
    normalizeWorkspace(cleaned);
    const removedContacts = original.contacts.length - cleaned.contacts.length;
    const removedCompanies =
      original.companies.length - cleaned.companies.length;
    if (!removedContacts && !removedCompanies && !original.demo) {
      console.log(
        JSON.stringify(
          {
            storage: config.mode,
            removedContacts: 0,
            removedCompanies: 0,
            remainingContacts: original.contacts.length,
            remainingCompanies: original.companies.length,
            unchanged: true,
          },
          null,
          2,
        ),
      );
      complete = true;
      break;
    }
    const backupDirectory = resolve("backups");
    await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
    const backup = join(
      backupDirectory,
      `reach-before-seed-removal-${config.mode}-${Date.now()}-${randomUUID()}.json`,
    );
    await writeFile(backup, JSON.stringify(original, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    const revision = Number(row.revision);
    const result = await client.execute({
      sql: "UPDATE workspace SET data=?,revision=? WHERE id=1 AND revision=?",
      args: [JSON.stringify(cleaned), revision + 1, revision],
    });
    if (result.rowsAffected !== 1) continue;
    console.log(
      JSON.stringify(
        {
          storage: config.mode,
          removedContacts,
          removedCompanies,
          remainingContacts: cleaned.contacts.length,
          remainingCompanies: cleaned.companies.length,
          backup,
          revision: revision + 1,
        },
        null,
        2,
      ),
    );
    complete = true;
    break;
  }
  if (!complete)
    throw Error(
      "Workspace kept changing. No newer data was overwritten; retry cleanup.",
    );
} catch (error) {
  console.error("Seed cleanup failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeDatabases();
}
