import { databaseConfig } from "../src/server/database-config.js";
import { readWorkspace, closeDatabases } from "../src/server/database.js";
try {
  const config = databaseConfig();
  const workspace = await readWorkspace();
  console.log(
    JSON.stringify(
      {
        connected: true,
        storage: config.mode,
        initialized: workspace.initialized,
        revision: workspace.revision,
        contacts: workspace.data.contacts.length,
        companies: workspace.data.companies.length,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error("Database check failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeDatabases();
}
