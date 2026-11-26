import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client/node";
import { startLibsqlHttpFixture } from "./helpers/libsql-http.mjs";

for (const key of [
  "TURSO_DATABASE_URL",
  "TURSO_AUTH_TOKEN",
  "CRM_REQUIRE_TURSO",
  "NETLIFY",
  "AWS_LAMBDA_FUNCTION_NAME",
])
  delete process.env[key];
const directory = mkdtempSync(join(tmpdir(), "reach-storage-test-"));
process.env.CRM_DB_PATH = join(directory, "local.sqlite");
const { databaseConfig } = await import("../src/server/database-config.js");
const { readWorkspace, closeDatabases } = await import(
  "../src/server/database.js"
);
const { initializeWorkspace, readStoredWorkspace } = await import(
  "../src/server/workspace-storage.js"
);
const { createRecord, logContactActivity, updateRecord } = await import(
  "../src/server/crm-service.js"
);
const { readLocalWorkspace, importIntoEmptyDatabase } = await import(
  "../src/server/workspace-migration.js"
);
const { workspaceFixture } = await import("./helpers/workspace-fixture.mjs");
let fixture;
after(async () => {
  await closeDatabases();
  await fixture?.close();
  rmSync(directory, { recursive: true, force: true });
});

test("serverless hosts require both remote credentials and never accept file or insecure remote URLs", () => {
  for (const env of [
    { NETLIFY: "true" },
    { AWS_LAMBDA_FUNCTION_NAME: "next-handler" },
    { CRM_REQUIRE_TURSO: "true" },
    { TURSO_DATABASE_URL: "libsql://example.turso.io" },
    { TURSO_AUTH_TOKEN: "token" },
  ])
    assert.throws(
      () => databaseConfig(env),
      (error) => error.status === 503,
    );
  for (const url of [
    "file:/tmp/db.sqlite",
    "http://remote.example",
    "libsql://user:password@example.turso.io",
    "libsql://example.turso.io?tls=0",
  ])
    assert.throws(
      () =>
        databaseConfig({ TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: "token" }),
      (error) => error.status === 503,
    );
  assert.throws(
    () =>
      databaseConfig({
        NETLIFY: "true",
        TURSO_DATABASE_URL: "http://127.0.0.1:8000",
        TURSO_AUTH_TOKEN: "token",
      }),
    (error) => error.status === 503,
  );
  assert.equal(
    databaseConfig({
      NETLIFY: "true",
      TURSO_DATABASE_URL: "libsql://example.turso.io",
      TURSO_AUTH_TOKEN: "token",
    }).mode,
    "turso",
  );
  assert.equal(
    databaseConfig({ CRM_DB_PATH: "/tmp/local.sqlite" }).mode,
    "local",
  );
});
test("concurrent snapshot mutations and activity appends preserve all accepted changes", async () => {
  await Promise.all(
    [1, 2, 3, 4].map((i) =>
      createRecord("companies", { id: `parallel-${i}`, name: `Company ${i}` }),
    ),
  );
  assert.equal((await readWorkspace()).data.companies.length, 4);
  await createRecord("contacts", {
    id: "parallel-contact",
    name: "Concurrent contact",
  });
  await Promise.all(
    [1, 2, 3, 4].map((i) =>
      logContactActivity("parallel-contact", {
        type: "Note",
        date: `2026-11-${10 + i}`,
        status: "Warm",
        note: `Entry ${i}`,
      }),
    ),
  );
  assert.equal((await readWorkspace()).data.contacts[0].activities.length, 4);
  const current = await readWorkspace();
  const attempts = await Promise.allSettled([
    updateRecord(
      "contacts",
      "parallel-contact",
      { role: "CTO" },
      current.revision,
    ),
    updateRecord(
      "contacts",
      "parallel-contact",
      { notes: "Concurrent edit" },
      current.revision,
    ),
  ]);
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    attempts.find((r) => r.status === "rejected").reason.status,
    409,
  );
});
test("old SQLite workspace migrates without changing its source and refuses a populated destination", async () => {
  const sourcePath = join(directory, "legacy.sqlite");
  const source = createClient({ url: pathToFileURL(sourcePath).href });
  const data = workspaceFixture();
  data.companies.forEach((c) => {
    delete c.status;
    delete c.country;
    delete c.linkedin;
  });
  const original = JSON.stringify(data);
  await source.batch(
    [
      "CREATE TABLE workspace(id INTEGER PRIMARY KEY,data TEXT,revision INTEGER,initialized INTEGER)",
      { sql: "INSERT INTO workspace VALUES(1,?,7,1)", args: [original] },
    ],
    "write",
  );
  source.close();
  const snapshot = await readLocalWorkspace(sourcePath);
  assert.equal(snapshot.revision, 7);
  assert.equal(snapshot.data.companies[0].status, "Not checked");
  const destination = createClient({
    url: pathToFileURL(join(directory, "migration-target.sqlite")).href,
  });
  try {
    const result = await importIntoEmptyDatabase(destination, snapshot);
    assert.equal(result.contacts, data.contacts.length);
    assert.equal(result.revision, 8);
    const stored = await readStoredWorkspace(destination);
    assert.deepEqual(stored.data, snapshot.data);
    assert.deepEqual(
      await readLocalWorkspace(join(directory, "migration-target.sqlite")),
      stored,
    );
    await assert.rejects(
      importIntoEmptyDatabase(destination, snapshot),
      (error) => error.status === 409,
    );
    assert.deepEqual(await readStoredWorkspace(destination), stored);
    const verifySource = createClient({ url: pathToFileURL(sourcePath).href });
    try {
      assert.equal(
        (await verifySource.execute("SELECT data FROM workspace")).rows[0].data,
        original,
      );
    } finally {
      verifySource.close();
    }
  } finally {
    destination.close();
  }
});
test("concurrent schema initialization migrates legacy IDs, company links, activity and revision once", async () => {
  const url = pathToFileURL(join(directory, "upgrade.sqlite")).href;
  const first = createClient({ url });
  const second = createClient({ url });
  const data = workspaceFixture();
  data.contacts[0].activities = [
    {
      id: "historic-note",
      type: "Note",
      date: "2026-11-12",
      note: "Retain this history.",
    },
  ];
  data.contacts.push({
    ...data.contacts[0],
    id: "independent",
    companyId: "",
    activities: [],
  });
  try {
    await first.batch(
      [
        "CREATE TABLE workspace(id INTEGER PRIMARY KEY,data TEXT,revision INTEGER,initialized INTEGER)",
        {
          sql: "INSERT INTO workspace VALUES(1,?,8,1)",
          args: [JSON.stringify(data)],
        },
      ],
      "write",
    );
    await Promise.all([
      initializeWorkspace(first),
      initializeWorkspace(second),
    ]);
    assert.deepEqual(await readStoredWorkspace(second), {
      data,
      revision: 8,
      initialized: true,
    });
    assert.deepEqual(
      (
        await first.execute(
          "SELECT id, company_id FROM contacts ORDER BY position",
        )
      ).rows,
      [
        { id: "fixture-person", company_id: "fixture-company" },
        { id: "independent", company_id: null },
      ],
    );
    assert.deepEqual(
      JSON.parse(
        (await first.execute("SELECT data FROM workspace")).rows[0].data,
      ),
      { profile: data.profile, demo: data.demo },
    );
    assert.deepEqual(
      (await first.execute("PRAGMA foreign_key_check")).rows,
      [],
    );
    await assert.rejects(
      first.execute(
        "UPDATE contacts SET company_id = 'missing' WHERE id = 'fixture-person'",
      ),
      /FOREIGN KEY/,
    );
  } finally {
    first.close();
    second.close();
  }
});
test("the official remote HTTP client reads and writes shared data without opening a local database", async () => {
  await closeDatabases();
  fixture = await startLibsqlHttpFixture(
    join(directory, "fixture.sqlite"),
    "http-test-database-token",
  );
  process.env.TURSO_DATABASE_URL = fixture.url;
  process.env.TURSO_AUTH_TOKEN = "http-test-database-token";
  process.env.CRM_DB_PATH = join(
    directory,
    "must-not-be-created",
    "local.sqlite",
  );
  assert.equal((await readWorkspace()).revision, 0);
  const created = await createRecord("companies", {
    id: "remote-co",
    name: "Remote Team",
  });
  await updateRecord(
    "companies",
    "remote-co",
    { country: "Algeria" },
    created.revision,
  );
  const stored = await readWorkspace();
  assert.equal(stored.data.companies[0].country, "Algeria");
  await closeDatabases();
  assert.deepEqual(await readWorkspace(), stored);
  assert.ok(fixture.requests > 0);
  assert.equal(existsSync(process.env.CRM_DB_PATH), false);
  fixture.setUnavailable(true);
  await assert.rejects(readWorkspace());
  assert.equal(existsSync(process.env.CRM_DB_PATH), false);
  fixture.setUnavailable(false);
  process.env.TURSO_AUTH_TOKEN = "wrong-token";
  await assert.rejects(readWorkspace());
  assert.equal(existsSync(process.env.CRM_DB_PATH), false);
});
