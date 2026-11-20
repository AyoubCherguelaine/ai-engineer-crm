import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const directory = mkdtempSync(join(tmpdir(), "reach-server-test-"));
process.env.CRM_DB_PATH = join(directory, "test.sqlite");
process.env.CRM_USERNAME = "test-user";
process.env.CRM_PASSWORD = "test-password-for-unit-tests";
process.env.SESSION_SECRET = "unit-test-secret-with-more-than-32-characters";
const {
  createSession,
  verifySession,
  checkCredentials,
  requireApiAuth,
  requireSameOrigin,
  sessionCookie,
  SESSION_SECONDS,
} = await import("../src/server/auth.js");
const { recordRoutes } = await import("../src/server/records.js");
const { readWorkspace, mutateWorkspace, database } =
  await import("../src/server/database.js");
const { normalizeWorkspace } = await import("../src/server/validation.js");
const { readJson, expectedRevision } = await import("../src/server/http.js");
const { seed } = await import("../src/lib/crm-data.js");
const auth =
  "Basic " +
  Buffer.from(
    `${process.env.CRM_USERNAME}:${process.env.CRM_PASSWORD}`,
  ).toString("base64");
function request(path, method = "GET", body, extra = {}) {
  return new Request("http://localhost:5173" + path, {
    method,
    headers: {
      Authorization: auth,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...extra,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
const companies = recordRoutes("companies"),
  contacts = recordRoutes("contacts");
const context = (id) => ({ params: Promise.resolve({ id }) });
after(() => {
  for (const [path, db] of globalThis.__reachDatabases ?? [])
    if (path === process.env.CRM_DB_PATH) {
      db.close();
      globalThis.__reachDatabases.delete(path);
    }
  rmSync(directory, { recursive: true, force: true });
});

test("API rejects unauthenticated reads and writes before accessing records", async () => {
  assert.equal(
    (await companies.list(new Request("http://localhost/api/companies")))
      .status,
    401,
  );
  assert.equal(
    (
      await contacts.create(
        new Request("http://localhost/api/contacts", { method: "POST" }),
      )
    ).status,
    401,
  );
});
test("signed sessions reject tampering, expiry, and credential changes", () => {
  checkCredentials("test-user", "test-password-for-unit-tests");
  const token = createSession(1000);
  assert.equal(verifySession(token, 2000), true);
  assert.equal(verifySession(token + "x", 2000), false);
  assert.equal(verifySession(token, (SESSION_SECONDS + 1) * 1000), false);
  const old = process.env.CRM_PASSWORD;
  process.env.CRM_PASSWORD = "new-password";
  assert.equal(verifySession(token, 2000), false);
  process.env.CRM_PASSWORD = old;
  assert.throws(
    () => checkCredentials("test-user", "wrong"),
    (error) => error.status === 401,
  );
});
test("missing auth configuration fails closed", () => {
  const old = process.env.SESSION_SECRET;
  delete process.env.SESSION_SECRET;
  assert.equal(verifySession("invalid"), false);
  assert.throws(
    () => requireApiAuth(request("/api/contacts")),
    (error) => error.status === 503,
  );
  process.env.SESSION_SECRET = old;
});
test("cookie and Basic mutation requests reject foreign origins", () => {
  const token = createSession();
  assert.doesNotThrow(() =>
    requireApiAuth(
      new Request("http://localhost/api/contacts", {
        headers: { cookie: `reach_session=${token}` },
      }),
    ),
  );
  assert.throws(
    () =>
      requireApiAuth(
        new Request("http://localhost/api/contacts", {
          method: "POST",
          headers: {
            cookie: `reach_session=${token}`,
            origin: "https://foreign.example",
          },
        }),
      ),
    (error) => error.status === 403,
  );
  assert.throws(
    () =>
      requireApiAuth(
        request(
          "/api/contacts",
          "POST",
          {},
          { Origin: "https://foreign.example" },
        ),
      ),
    (error) => error.status === 403,
  );
});
test("same-origin checks respect Next's incoming hostname and HTTPS cookies", () => {
  assert.doesNotThrow(() =>
    requireSameOrigin(
      new Request("http://localhost:5173/api/auth/login", {
        method: "POST",
        headers: { Host: "127.0.0.1:5173", Origin: "http://127.0.0.1:5173" },
      }),
    ),
  );
  assert.equal(
    sessionCookie(
      new Request("https://crm.example.com"),
      createSession(),
    ).includes("; Secure"),
    true,
  );
});

test("browser same-origin metadata works behind rewritten preview hosts", () => {
  assert.doesNotThrow(() =>
    requireSameOrigin(
      new Request("http://localhost:5173/api/auth/login", {
        method: "POST",
        headers: {
          Host: "localhost:5173",
          Origin: "https://preview.example.com",
          "Sec-Fetch-Site": "same-origin",
        },
      }),
    ),
  );
  for (const site of ["cross-site", "same-site"]) {
    assert.throws(
      () =>
        requireSameOrigin(
          new Request("http://localhost:5173/api/auth/login", {
            method: "POST",
            headers: {
              Host: "localhost:5173",
              Origin: "https://foreign.example",
              "Sec-Fetch-Site": site,
            },
          }),
        ),
      (error) => error.status === 403,
    );
  }
  assert.throws(
    () =>
      requireSameOrigin(
        new Request("http://localhost:5173/api/auth/login", {
          method: "POST",
          headers: { Origin: "null", "Sec-Fetch-Site": "same-origin" },
        }),
      ),
    (error) => error.status === 403,
  );
});

test("create, read, filter, and patch companies and contacts using minimal JSON", async () => {
  const co = await companies.create(
    request("/api/companies", "POST", {
      id: "acme",
      name: "Acme",
      country: "Algeria",
      linkedin: "https://linkedin.com/company/acme",
    }),
  );
  assert.equal(co.status, 201);
  const company = (await co.json()).data;
  assert.equal(company.status, "Not checked");
  const person = await contacts.create(
    request("/api/contacts", "POST", {
      id: "sarah",
      name: "Sarah",
      companyId: "acme",
      role: "CTO",
    }),
  );
  assert.equal(person.status, 201);
  assert.equal((await person.json()).data.status, "Not checked");
  const updated = await companies.update(
    request("/api/companies/acme", "PATCH", { status: "Warm" }),
    context("acme"),
  );
  assert.equal(updated.status, 200);
  const body = await updated.json();
  assert.equal(body.data.country, "Algeria");
  assert.equal(body.data.name, "Acme");
  const contact = await contacts.update(
    request("/api/contacts/sarah", "PATCH", {
      status: "To reach out",
      followUp: "2026-12-01",
    }),
    context("sarah"),
  );
  assert.equal(contact.status, 200);
  assert.equal(
    (
      await (
        await contacts.get(request("/api/contacts/sarah"), context("sarah"))
      ).json()
    ).data.companyId,
    "acme",
  );
  assert.equal(
    (
      await (
        await companies.list(request("/api/companies?q=algeria&status=Warm"))
      ).json()
    ).total,
    1,
  );
  assert.equal(
    (await contacts.get(request("/api/contacts/missing"), context("missing")))
      .status,
    404,
  );
});
test("validation and conflicting identifiers roll back atomically", async () => {
  const before = readWorkspace().revision;
  assert.equal(
    (
      await companies.create(
        request("/api/companies", "POST", { id: "acme", name: "Duplicate" }),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await contacts.create(
        request("/api/contacts", "POST", {
          name: "Bad relation",
          companyId: "unknown",
        }),
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await contacts.update(
        request("/api/contacts/sarah", "PATCH", { lastContact: "2026-02-30" }),
        context("sarah"),
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await companies.update(
        request("/api/companies/acme", "PATCH", { unexpected: true }),
        context("acme"),
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await companies.update(
        request("/api/companies/acme", "PATCH", {}),
        context("acme"),
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await companies.update(
        request("/api/companies/acme", "PATCH", {
          website: "javascript:alert(1)",
        }),
        context("acme"),
      )
    ).status,
    422,
  );
  assert.equal(readWorkspace().revision, before);
});
test("stale workspace revisions cannot overwrite API updates", async () => {
  const stale = readWorkspace();
  await contacts.update(
    request("/api/contacts/sarah", "PATCH", { notes: "Added through API" }),
    context("sarah"),
  );
  assert.throws(
    () => mutateWorkspace(() => stale.data, stale.revision),
    (error) => error.status === 409,
  );
  assert.equal(
    readWorkspace().data.contacts.find((c) => c.id === "sarah").notes,
    "Added through API",
  );
  assert.throws(
    () => expectedRevision(request("/api/workspace"), true),
    (error) => error.status === 428,
  );
});
test("old backups normalize company status without losing records", () => {
  const old = structuredClone(seed);
  old.companies.forEach((c) => {
    delete c.status;
    delete c.country;
    delete c.linkedin;
  });
  const normalized = normalizeWorkspace(old);
  assert.equal(normalized.companies[0].status, "Not checked");
  assert.equal(normalized.contacts.length, old.contacts.length);
});
test("database records survive reopening the SQLite connection", () => {
  const before = readWorkspace();
  database().close();
  globalThis.__reachDatabases.delete(process.env.CRM_DB_PATH);
  assert.deepEqual(readWorkspace(), before);
});
test("company deletion keeps contacts and clears their company link", async () => {
  assert.equal(
    (
      await companies.remove(
        request("/api/companies/acme", "DELETE"),
        context("acme"),
      )
    ).status,
    200,
  );
  assert.equal(
    readWorkspace().data.contacts.find((c) => c.id === "sarah").companyId,
    "",
  );
});
test("JSON requests enforce content type, validity, and payload limits", async () => {
  await assert.rejects(
    readJson(new Request("http://localhost", { method: "POST", body: "{}" })),
    (error) => error.status === 415,
  );
  await assert.rejects(
    readJson(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad",
      }),
    ),
    (error) => error.status === 400,
  );
  await assert.rejects(
    readJson(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "a".repeat(5 * 1024 * 1024 + 1),
      }),
    ),
    (error) => error.status === 413,
  );
});

test("activities persist explicit status/date and older activities remain compatible", async () => {
  const created = await contacts.create(
    request("/api/contacts", "POST", {
      id: "activity-person",
      name: "Activity Person",
    }),
  );
  assert.equal(created.status, 201);
  const activities = [
    {
      id: "entry-new",
      type: "Reply received",
      date: "2026-11-12",
      status: "Closed",
      note: "Not available.",
    },
    {
      id: "entry-legacy",
      type: "Message sent",
      date: "2026-11-10",
      note: "Older entry with no status.",
    },
  ];
  const response = await contacts.update(
    request("/api/contacts/activity-person", "PATCH", {
      status: "Closed",
      replyDate: "2026-11-12",
      activities,
    }),
    context("activity-person"),
  );
  assert.equal(response.status, 200);
  const saved = (
    await (
      await contacts.get(
        request("/api/contacts/activity-person"),
        context("activity-person"),
      )
    ).json()
  ).data;
  assert.equal(saved.status, "Closed");
  assert.deepEqual(saved.activities, activities);
  const invalid = await contacts.update(
    request("/api/contacts/activity-person", "PATCH", {
      activities: [{ ...activities[0], status: "Invalid" }],
    }),
    context("activity-person"),
  );
  assert.equal(invalid.status, 422);
});

test("repeated credential failures are rate limited", () => {
  for (let i = 0; i < 10; i++) {
    try {
      checkCredentials("test-user", "incorrect");
    } catch {}
  }
  assert.throws(
    () => checkCredentials("test-user", "incorrect"),
    (error) => error.status === 429,
  );
});
