import "server-only";
import { ApiError } from "./errors.js";
import {
  companyDefaults,
  contactDefaults,
  emptyWorkspace,
  normalizeWorkspace,
} from "./validation.js";

const workspaceSelect =
  "SELECT data, revision, initialized FROM workspace WHERE id = 1";
const logLimit = 5000;
const expireLogs = `DELETE FROM mcp_logs WHERE id <= (
  SELECT id FROM mcp_logs ORDER BY id DESC LIMIT 1 OFFSET ${logLimit}
)`;
const columns = {
  companies: fields(companyDefaults),
  contacts: fields(contactDefaults),
};

function fields(defaults) {
  return ["id", "name", ...Object.keys(defaults)].map((key) => ({
    key,
    column: key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
    type:
      {
        id: `TEXT PRIMARY KEY NOT NULL CHECK(
        length(id) BETWEEN 1 AND 128 AND id GLOB '[A-Za-z0-9]*'
        AND id NOT GLOB '*[^A-Za-z0-9_-]*'
      )`,
        companyId: "TEXT REFERENCES companies(id) ON DELETE SET NULL",
        activities:
          "TEXT NOT NULL CHECK(json_valid(activities) AND json_type(activities) = 'array')",
      }[key] ?? "TEXT NOT NULL",
  }));
}

function recordTable(kind) {
  const fields = columns[kind].map(({ column, type }) => `${column} ${type}`);
  return `CREATE TABLE IF NOT EXISTS ${kind} (${fields.join(", ")}, position INTEGER NOT NULL)`;
}

const schema = [
  `CREATE TABLE IF NOT EXISTS workspace (
    id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0, initialized INTEGER NOT NULL DEFAULT 0
  )`,
  recordTable("companies"),
  recordTable("contacts"),
  "CREATE INDEX IF NOT EXISTS contacts_company_id ON contacts(company_id)",
  `CREATE TABLE IF NOT EXISTS mcp_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    tool TEXT NOT NULL,
    record_id TEXT NOT NULL,
    fields TEXT NOT NULL CHECK(json_valid(fields) AND json_type(fields) = 'array'),
    revision INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS mcp_log_details (
    log_id INTEGER PRIMARY KEY REFERENCES mcp_logs(id) ON DELETE CASCADE,
    changes TEXT NOT NULL CHECK(json_valid(changes)),
    superseded INTEGER NOT NULL DEFAULT 0,
    undone_revision INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS mcp_log_records (
    log_id INTEGER NOT NULL REFERENCES mcp_log_details(log_id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    record_id TEXT NOT NULL,
    PRIMARY KEY(log_id, kind, record_id)
  )`,
  "CREATE INDEX IF NOT EXISTS mcp_log_records_lookup ON mcp_log_records(kind, record_id)",
  `CREATE TRIGGER IF NOT EXISTS mcp_logs_retention AFTER INSERT ON mcp_logs
   BEGIN ${expireLogs}; END`,
  expireLogs,
];

function metadata({ profile, demo }) {
  return JSON.stringify({ profile, demo });
}

function decodeMetadata(row) {
  if (!row) throw new ApiError(422, "Workspace metadata is missing.");
  const revision = Number(row.revision);
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new ApiError(422, "Invalid workspace revision.");
  return {
    data: JSON.parse(String(row.data)),
    revision,
    initialized: Boolean(Number(row.initialized)),
  };
}

// Metadata and records come from the same read transaction, even during a write.
export async function readStoredWorkspace(client) {
  const [settings, companies, contacts] = await client.batch(
    [
      workspaceSelect,
      "SELECT * FROM companies ORDER BY position, id",
      "SELECT * FROM contacts ORDER BY position, id",
    ],
    "read",
  );
  const snapshot = decodeMetadata(settings.rows[0]);
  const data = {
    ...snapshot.data,
    companies: companies.rows.map(decodeRecord("companies")),
    contacts: contacts.rows.map(decodeRecord("contacts")),
  };
  return { ...snapshot, data };
}

function decodeRecord(kind) {
  return (row) =>
    Object.fromEntries(
      columns[kind].map(({ key, column }) => [
        key,
        key === "activities" ? JSON.parse(row[column]) : (row[column] ?? ""),
      ]),
    );
}

function recordDiff(kind, previous, next) {
  const prior = new Map(
    previous.map((record, i) => [
      record.id,
      { record, position: i - previous.length },
    ]),
  );
  const changed = [];
  const edited = [];
  next.forEach((record, i) => {
    const position = i - next.length;
    const existing = prior.get(record.id);
    const differs =
      !existing ||
      columns[kind].some(({ key }) =>
        key === "activities"
          ? JSON.stringify(existing.record.activities) !==
            JSON.stringify(record.activities)
          : existing.record[key] !== record[key],
      );
    if (differs) edited.push({ kind, id: record.id });
    if (differs || existing.position !== position)
      changed.push({ ...record, position });
    prior.delete(record.id);
  });
  const removed = [...prior.keys()];
  for (const id of removed) edited.push({ kind, id });
  return { changed, removed, edited };
}

function removeRecords(kind, removed, guard) {
  if (!removed.length) return [];
  return [
    {
      sql: `DELETE FROM ${kind} WHERE ${guard.sql} AND id IN (SELECT value FROM json_each(?))`,
      args: [guard.revision, JSON.stringify(removed)],
    },
  ];
}

function upsertRecords(kind, changed, guard) {
  if (!changed.length) return [];
  const fields = [...columns[kind], { key: "position", column: "position" }];
  const values = fields.map(({ key }) =>
    key === "companyId"
      ? "NULLIF(json_extract(value, '$.companyId'), '')"
      : `json_extract(value, '$.${key}')`,
  );
  return [
    {
      sql: `INSERT INTO ${kind} (${fields.map(({ column }) => column).join(", ")})
      SELECT ${values.join(", ")} FROM json_each(?) WHERE ${guard.sql}
      ON CONFLICT(id) DO UPDATE SET
      ${fields
        .slice(1)
        .map(({ column }) => `${column} = excluded.${column}`)
        .join(", ")}`,
      args: [JSON.stringify(changed), guard.revision],
    },
  ];
}

export async function writeStoredWorkspace(
  client,
  current,
  next,
  { legacy = false, audit, undo } = {},
) {
  const condition = `id = 1 AND revision = ? AND json_type(data, '$.contacts') IS ${legacy ? "NOT " : ""}NULL`;
  const guard = {
    sql: `EXISTS (SELECT 1 FROM workspace WHERE ${condition})`,
    revision: current.revision,
  };
  const companies = recordDiff(
    "companies",
    current.data.companies,
    next.data.companies,
  );
  const contacts = recordDiff(
    "contacts",
    current.data.contacts,
    next.data.contacts,
  );
  const statements = [
    ...upsertRecords("companies", companies.changed, guard),
    ...removeRecords("contacts", contacts.removed, guard),
    ...upsertRecords("contacts", contacts.changed, guard),
    ...removeRecords("companies", companies.removed, guard),
  ];
  // Track later changes for exactly the records covered by each audit entry.
  const edited = [...contacts.edited, ...companies.edited];
  if (edited.length) {
    statements.push({
      sql: `UPDATE mcp_log_details SET superseded = 1
        WHERE superseded = 0 AND ${guard.sql} AND log_id IN (
          SELECT records.log_id FROM json_each(?) AS edits
          JOIN mcp_log_records AS records
          ON records.kind = json_extract(edits.value, '$.kind')
          AND records.record_id = json_extract(edits.value, '$.id')
        )`,
      args: [guard.revision, JSON.stringify(edited)],
    });
  }
  if (undo) {
    statements.push({
      sql: `UPDATE mcp_log_details SET undone_revision = ? WHERE log_id = ? AND ${guard.sql}`,
      args: [next.revision, undo, guard.revision],
    });
  }
  if (audit) {
    statements.push({
      sql: `INSERT INTO mcp_logs (tool, record_id, fields, revision)
            SELECT ?, ?, ?, ? WHERE ${guard.sql}`,
      args: [
        audit.tool,
        audit.recordId,
        JSON.stringify(audit.fields),
        next.revision,
        guard.revision,
      ],
    });
  }
  if (audit?.changes) {
    statements.push(
      {
        sql: `INSERT INTO mcp_log_details (log_id, changes)
            SELECT last_insert_rowid(), ? WHERE ${guard.sql}`,
        args: [JSON.stringify(audit.changes), guard.revision],
      },
      {
        sql: `INSERT INTO mcp_log_records (log_id, kind, record_id)
            SELECT details.log_id, json_extract(item.value, '$.kind'), json_extract(item.value, '$.recordId')
            FROM mcp_log_details AS details, json_each(details.changes) AS item
            WHERE details.log_id = last_insert_rowid() AND ${guard.sql}`,
        args: [guard.revision],
      },
    );
  }
  // Evaluate every change against the same revision, then advance it last.
  statements.push({
    sql: `UPDATE workspace SET data = ?, revision = ?, initialized = ? WHERE ${condition}`,
    args: [
      metadata(next.data),
      next.revision,
      Number(next.initialized),
      guard.revision,
    ],
  });
  return (await client.batch(statements, "write")).at(-1).rowsAffected === 1;
}

export async function initializeWorkspace(client) {
  await client.batch(
    [
      ...schema,
      {
        sql: "INSERT OR IGNORE INTO workspace (id, data) VALUES (1, ?)",
        args: [metadata(emptyWorkspace())],
      },
    ],
    "write",
  );
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = decodeMetadata(
      (await client.execute(workspaceSelect)).rows[0],
    );
    if (!Object.hasOwn(current.data, "contacts")) return;
    const next = { ...current, data: normalizeWorkspace(current.data) };
    if (
      await writeStoredWorkspace(
        client,
        { ...current, data: emptyWorkspace() },
        next,
        { legacy: true },
      )
    )
      return;
  }
  throw new ApiError(
    409,
    "Workspace changed during schema migration. Please retry.",
  );
}

// Reads legacy files without converting them. Used by the local-to-Turso
// migration and by the seed-cleanup script before it creates its backup.
export async function readLegacyWorkspace(client) {
  const { rows } = await client.execute(
    "SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'workspace'",
  );
  if (!rows.length) return null;
  const snapshot = decodeMetadata(
    (await client.execute(workspaceSelect)).rows[0],
  );
  return Object.hasOwn(snapshot.data, "contacts") ? snapshot : null;
}

export async function readMcpLogs(client, { limit, beforeId }) {
  const { rows } = await client.execute({
    sql: `SELECT id, created_at AS createdAt, tool, record_id AS recordId, fields, revision
          FROM mcp_logs WHERE (? IS NULL OR id < ?) ORDER BY id DESC LIMIT ?`,
    args: [beforeId ?? null, beforeId ?? null, limit + 1],
  });
  const data = rows
    .slice(0, limit)
    .map((row) => ({ ...row, fields: JSON.parse(row.fields) }));
  return { data, nextBeforeId: rows.length > limit ? data.at(-1).id : null };
}

export async function readMcpLogDetail(client, id) {
  const { rows } = await client.execute({
    sql: `SELECT log.id, log.created_at AS createdAt, log.tool, log.record_id AS recordId,
          log.revision, log.fields, workspace.revision AS workspaceRevision, details.changes,
          details.superseded, details.undone_revision AS undoneRevision
          FROM mcp_logs AS log
          JOIN workspace ON workspace.id = 1
          LEFT JOIN mcp_log_details AS details ON details.log_id = log.id
          WHERE log.id = ?`,
    args: [id],
  });
  const row = rows[0];
  return row
    ? {
        ...row,
        fields: JSON.parse(row.fields),
        superseded: Boolean(row.superseded),
        changes: row.changes ? JSON.parse(row.changes) : null,
      }
    : null;
}
