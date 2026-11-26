import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createRecord,
  getRecord,
  logContactActivity,
  updateRecord,
} from "../src/server/crm-service.js";
import {
  closeDatabases,
  database,
  mutateWorkspace,
  readWorkspace,
} from "../src/server/database.js";
import { contactDefaults } from "../src/server/validation.js";
import { mergeContacts } from "../src/server/contact-merge.js";
import {
  applyContactImport,
  previewContactImport,
} from "../src/server/contact-import.js";
import { getMcpLog, undoMcpLog } from "../src/server/mcp-audit.js";
import {
  readMcpLogs,
  writeStoredWorkspace,
} from "../src/server/workspace-storage.js";
import { completeFollowUp, followUpQueue } from "../src/lib/follow-up-queue.js";

for (const key of [
  "TURSO_DATABASE_URL",
  "TURSO_AUTH_TOKEN",
  "CRM_REQUIRE_TURSO",
  "NETLIFY",
  "AWS_LAMBDA_FUNCTION_NAME",
])
  delete process.env[key];
const directory = mkdtempSync(join(tmpdir(), "reach-workflows-"));
process.env.CRM_DB_PATH = join(directory, "workflows.sqlite");
after(async () => {
  await closeDatabases();
  rmSync(directory, { recursive: true, force: true });
});

const conflict = (error) => error.status === 409;
const createContact = (record, tool) =>
  createRecord("contacts", record, undefined, tool);
const latestLog = async () =>
  (await readMcpLogs(await database(), { limit: 1 })).data[0];

test("contact identity checks cover equivalent LinkedIn URLs, email case, snapshots, and concurrent requests", async () => {
  await createContact({
    id: "person-a",
    name: "Person A",
    email: "Person@example.com",
    linkedin: "https://www.linkedin.com/in/Person/?trk=source",
  });
  await assert.rejects(
    createContact({ name: "Email duplicate", email: "person@EXAMPLE.COM" }),
    conflict,
  );
  await assert.rejects(
    createContact({
      name: "LinkedIn duplicate",
      linkedin: "https://fr.linkedin.com/in/person#contact",
    }),
    conflict,
  );
  await assert.rejects(
    mutateWorkspace((workspace) => ({
      ...workspace,
      contacts: [
        ...workspace.contacts,
        {
          ...contactDefaults,
          id: "duplicate",
          name: "Duplicate",
          email: "person@example.com",
        },
      ],
    })),
    conflict,
  );
  await createContact({
    id: "person-b",
    name: "Person B",
    linkedin: "https://linkedin.com/company/person",
  });
  await assert.rejects(
    updateRecord("contacts", "person-b", { email: "person@example.com" }),
    conflict,
  );
  const results = await Promise.allSettled([
    createContact({ name: "Racer 1", email: "race@example.com" }),
    createContact({ name: "Racer 2", email: "RACE@example.com" }),
  ]);
  assert.equal(
    results.filter(({ status }) => status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter(
      ({ status, reason }) => status === "rejected" && reason.status === 409,
    ).length,
    1,
  );
});

test("CSV preview and apply agree on create, update and fix rows; stale previews are rejected", async () => {
  await createContact({
    id: "csv-original",
    name: "Existing CSV",
    email: "csv@example.com",
    notes: "Keep this note",
  });
  const csv =
    '\uFEFFname,email,role,notes,companyId\r\n,CSV@example.com,Engineer,,\r\n"New, Person",new-csv@example.com,Lead,"A ""quoted""\r\nnote",\r\nBad,bad-email,,,\r\nDuplicate,new-csv@example.com,,,\r\nMissing,missing@example.com,,,missing-company';
  const preview = await previewContactImport(csv);
  assert.deepEqual(
    preview.rows.map(({ line, action }) => [line, action]),
    [
      [2, "update"],
      [3, "create"],
      [5, "fix"],
      [6, "fix"],
      [7, "fix"],
    ],
  );
  assert.equal((await getRecord("contacts", "csv-original")).data.role, "");
  await createContact({ name: "Intervening edit" });
  await assert.rejects(applyContactImport(csv, preview.revision), conflict);
  const current = await previewContactImport(csv);
  const applied = await applyContactImport(csv, current.revision);
  assert.equal(
    applied.data.contacts.find(({ id }) => id === "csv-original").notes,
    "Keep this note",
  );
  assert.equal(
    applied.data.contacts.find(({ id }) => id === "csv-original").role,
    "Engineer",
  );
  const created = applied.data.contacts.find(
    ({ email }) => email === "new-csv@example.com",
  );
  assert.equal(created.name, "New, Person");
  assert.equal(created.notes, 'A "quoted"\nnote');
  assert.equal(
    applied.data.contacts.some(({ name }) => name === "Missing"),
    false,
  );
  await assert.rejects(
    previewContactImport('name,email\n"Bad,example@example.com'),
    /Unclosed quote/,
  );
});

test("audited merge preserves notes and distinct activities and can be undone without overwriting later work", async () => {
  const activity = {
    id: "same-id",
    type: "Note",
    date: "2026-11-20",
    note: "Primary activity",
  };
  await createContact({
    id: "merge-keep",
    name: "Primary",
    notes: "Primary notes",
    activities: [activity],
  });
  const source = await createContact({
    id: "merge-source",
    name: "Secondary",
    notes: "Other notes",
    role: "Founder",
    activities: [{ ...activity, note: "Secondary activity" }],
  });
  const merged = await mergeContacts(
    { keepId: "merge-keep", mergeId: "merge-source" },
    source.revision,
    "merge_contacts",
  );
  const kept = merged.data.contacts.find(({ id }) => id === "merge-keep");
  assert.equal(kept.name, "Primary");
  assert.equal(kept.role, "Founder");
  assert.equal(kept.notes, "Primary notes\n\nOther notes");
  assert.equal(kept.activities.length, 2);
  assert.equal(new Set(kept.activities.map(({ id }) => id)).size, 2);
  assert.equal(
    merged.data.contacts.some(({ id }) => id === "merge-source"),
    false,
  );

  const log = await getMcpLog((await latestLog()).id);
  assert.deepEqual(
    log.changes.map(({ recordId }) => recordId),
    ["merge-keep", "merge-source"],
  );
  assert.equal(log.changes[0].before.notes, "Primary notes");
  assert.equal(log.changes[1].after, null);
  const unrelated = await createContact({ name: "Unrelated newer record" });
  await assert.rejects(undoMcpLog(log.id, log.workspaceRevision), conflict);
  const restored = await undoMcpLog(log.id, unrelated.revision);
  assert.equal(
    restored.data.contacts.find(({ id }) => id === "merge-keep").notes,
    "Primary notes",
  );
  assert.deepEqual(
    restored.data.contacts.find(({ id }) => id === "merge-source"),
    source.data,
  );
  assert.equal((await getMcpLog(log.id)).undoneRevision, restored.revision);
  assert.equal(
    restored.data.contacts.some(({ id }) => id === unrelated.data.id),
    true,
  );
  await assert.rejects(undoMcpLog(log.id, restored.revision), /already undone/);
});

test("merging a legacy duplicate group reduces it and undo restores only the previous members", async () => {
  const client = await database();
  const before = await readWorkspace();
  const email = "legacy-trio@example.com";
  const records = ["legacy-keep", "legacy-source", "legacy-other"].map(
    (id) => ({
      ...contactDefaults,
      id,
      name: id,
      email: id === "legacy-keep" ? "" : email,
    }),
  );
  assert.equal(
    await writeStoredWorkspace(client, before, {
      ...before,
      revision: before.revision + 1,
      data: { ...before.data, contacts: [...records, ...before.data.contacts] },
    }),
    true,
  );
  const merged = await mergeContacts(
    { keepId: "legacy-keep", mergeId: "legacy-source" },
    before.revision + 1,
    "merge_contacts",
  );
  assert.equal(
    merged.data.contacts.find(({ id }) => id === "legacy-keep").email,
    email,
  );
  const undone = await undoMcpLog((await latestLog()).id, merged.revision);
  assert.deepEqual(
    undone.data.contacts
      .filter((record) => record.email === email)
      .map(({ id }) => id),
    ["legacy-source", "legacy-other"],
  );
});

test("undo protects against newer edits, even if a field was changed and changed back", async () => {
  await createContact({ id: "undo-protected", name: "Protected" });
  const edit = await updateRecord(
    "contacts",
    "undo-protected",
    { role: "Engineer" },
    undefined,
    "update_contact",
  );
  const log = await getMcpLog((await latestLog()).id);
  assert.deepEqual(log.changes[0].before, { role: "" });
  assert.deepEqual(log.changes[0].after, { role: "Engineer" });
  const activity = await logContactActivity("undo-protected", {
    type: "Note",
    date: "2026-11-25",
    status: "Warm",
  });
  assert.ok(activity.revision > edit.revision);
  await updateRecord("contacts", "undo-protected", { role: "Lead" });
  const latest = await updateRecord("contacts", "undo-protected", {
    role: "Engineer",
  });
  assert.equal((await getMcpLog(log.id)).superseded, true);
  await assert.rejects(undoMcpLog(log.id, latest.revision), /later change/);
});

test("undo of a new company with linked contacts is rejected, while an untouched contact can be removed", async () => {
  const company = await createRecord(
    "companies",
    { name: "New Company" },
    undefined,
    "create_company",
  );
  const companyLog = await latestLog();
  const linked = await createContact({
    name: "Linked",
    companyId: company.data.id,
  });
  await assert.rejects(
    undoMcpLog(companyLog.id, linked.revision),
    /Contacts are now linked/,
  );
  const created = await createContact(
    { name: "Undo this contact" },
    "create_contact",
  );
  const result = await undoMcpLog((await latestLog()).id, created.revision);
  assert.equal(
    result.data.contacts.some(({ id }) => id === created.data.id),
    false,
  );
});

test("Today separates due dates, ignores closed records and records a sent message in history", () => {
  const today = "2026-11-26";
  const active = {
    ...contactDefaults,
    status: "To reach out",
    followUp: today,
  };
  const earlier = { ...active, followUp: "2026-11-25", meetingDate: today };
  const later = {
    ...active,
    followUp: "2026-11-27",
    meetingDate: "2026-11-28",
  };
  assert.deepEqual(
    followUpQueue(
      [active, later, earlier, { ...active, status: "Closed" }],
      today,
    ),
    {
      overdue: [earlier],
      today: [active],
      meetings: [earlier, later],
    },
  );
  const sent = completeFollowUp(active, today);
  assert.equal(sent.followUp, "");
  assert.equal(sent.lastContact, today);
  assert.equal(sent.status, "No response");
  assert.equal(sent.activities[0].type, "Message sent");
  assert.deepEqual(followUpQueue([sent], today).today, []);
});

test("log retention also removes expired details and record references", async () => {
  await createContact({ name: "Expired audit record" }, "create_contact");
  const logWithDetails = (await latestLog()).id;
  const client = await database();
  await client.execute(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 5000)
    INSERT INTO mcp_logs (tool, record_id, fields, revision) SELECT 'test','retention','[]',i FROM n`);
  await assert.rejects(
    getMcpLog(logWithDetails),
    (error) => error.status === 404,
  );
  for (const table of ["mcp_log_details", "mcp_log_records"])
    assert.equal(
      (await client.execute(`SELECT COUNT(*) AS count FROM ${table}`)).rows[0]
        .count,
      0,
    );
  assert.equal((await readWorkspace()).initialized, true);
});
