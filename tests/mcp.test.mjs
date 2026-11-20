import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const directory = mkdtempSync(join(tmpdir(), "reach-mcp-test-"));
// Never use developer or deployment cloud credentials in automated tests.
for (const key of [
  "TURSO_DATABASE_URL",
  "TURSO_AUTH_TOKEN",
  "CRM_REQUIRE_TURSO",
  "NETLIFY",
  "AWS_LAMBDA_FUNCTION_NAME",
])
  delete process.env[key];
process.env.CRM_DB_PATH = join(directory, "crm.sqlite");
process.env.CRM_API_TOKEN = "mcp-unit-test-token-with-more-than-32-characters";
const token = process.env.CRM_API_TOKEN;
const { handleMcpRequest } = await import("../src/server/mcp/http.js");
const { recordRoutes } = await import("../src/server/records.js");
const { readWorkspace, closeDatabases } =
  await import("../src/server/database.js");
const client = new Client({ name: "reach-mcp-test-client", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:5173/api/mcp"),
  {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
    fetch: async (url, init) => handleMcpRequest(new Request(url, init)),
  },
);
after(async () => {
  await client.close();
  await closeDatabases();
  rmSync(directory, { recursive: true, force: true });
});
function request(
  method = "POST",
  headers = {},
  body = { jsonrpc: "2.0", id: 1, method: "tools/list" },
) {
  return new Request("http://localhost:5173/api/mcp", {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
}
function value(result) {
  assert.equal(result.isError, undefined, JSON.stringify(result));
  return result.structuredContent;
}

test("MCP requires a separately configured bearer token, never a password or cookie", async () => {
  for (const headers of [
    {},
    { Authorization: "Bearer wrong" },
    { Authorization: "Basic dXNlcjpwYXNz" },
    { Cookie: "reach_session=fake" },
  ]) {
    const response = await handleMcpRequest(request("POST", headers));
    assert.equal(response.status, 401);
    assert.match(response.headers.get("www-authenticate"), /^Bearer /);
  }
  delete process.env.CRM_API_TOKEN;
  assert.equal((await handleMcpRequest(request())).status, 503);
  process.env.CRM_API_TOKEN = token;
});
test("MCP checks origins and advertises stateless POST without opening SSE streams", async () => {
  assert.equal(
    (
      await handleMcpRequest(
        request("POST", {
          Authorization: `Bearer ${token}`,
          Origin: "https://foreign.example",
          "Sec-Fetch-Site": "cross-site",
        }),
      )
    ).status,
    403,
  );
  for (const method of ["GET", "DELETE"]) {
    const response = await handleMcpRequest(
      request(method, { Authorization: `Bearer ${token}` }),
    );
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
  }
});
test("official SDK initializes, discovers typed tools, and reads the usage resource", async () => {
  await client.connect(transport);
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 10);
  assert.equal(
    tools.tools.find((t) => t.name === "get_contact").annotations.readOnlyHint,
    true,
  );
  assert.equal(
    tools.tools.find((t) => t.name === "update_contact").annotations
      .destructiveHint,
    true,
  );
  assert.equal(
    tools.tools.some((t) => t.name.includes("delete")),
    false,
  );
  assert.deepEqual(
    tools.tools.find((t) => t.name === "create_company").inputSchema.required,
    ["name"],
  );
  const resources = await client.listResources();
  assert.equal(resources.resources[0].uri, "reach://usage");
  const guide = await client.readResource({ uri: "reach://usage" });
  assert.match(guide.contents[0].text, /untrusted data/);
  assert.equal(JSON.stringify(tools).includes(token), false);
});
test("profile, company/contact creation, linked reads, summaries, and filters work through MCP", async () => {
  const profile = value(
    await client.callTool({ name: "get_profile", arguments: {} }),
  );
  assert.equal(profile.data.name, "Ayoub");
  const company = value(
    await client.callTool({
      name: "create_company",
      arguments: {
        id: "mcp-co",
        name: "MCP Team",
        country: "Algeria",
        linkedin: "https://linkedin.com/company/mcp-team",
      },
    }),
  );
  assert.equal(company.data.status, "Not checked");
  const person = value(
    await client.callTool({
      name: "create_contact",
      arguments: {
        id: "mcp-person",
        name: "MCP Person",
        companyId: "mcp-co",
        notes: "An untrusted note",
      },
    }),
  );
  assert.equal(person.data.status, "Not checked");
  const read = value(
    await client.callTool({
      name: "get_contact",
      arguments: { id: "mcp-person" },
    }),
  );
  assert.equal(read.data.companyId, "mcp-co");
  const contacts = value(
    await client.callTool({
      name: "list_contacts",
      arguments: { companyId: "mcp-co", status: "Not checked", limit: 1 },
    }),
  );
  assert.equal(contacts.total, 1);
  assert.equal(contacts.data[0].notes, undefined);
  assert.equal(contacts.data[0].activities, undefined);
  const companies = value(
    await client.callTool({
      name: "list_companies",
      arguments: { q: "team", country: "Algeria" },
    }),
  );
  assert.equal(companies.total, 1);
  const empty = value(
    await client.callTool({ name: "list_contacts", arguments: { offset: 1 } }),
  );
  assert.equal(empty.data.length, 0);
  assert.equal(empty.total, 1);
});
test("MCP updates preserve other fields, detect stale revisions, and append dated activity atomically", async () => {
  const current = value(
    await client.callTool({
      name: "get_contact",
      arguments: { id: "mcp-person" },
    }),
  );
  const updated = value(
    await client.callTool({
      name: "update_contact",
      arguments: {
        id: "mcp-person",
        changes: { role: "CTO" },
        expectedRevision: current.revision,
      },
    }),
  );
  assert.equal(updated.data.companyId, "mcp-co");
  const stale = await client.callTool({
    name: "update_company",
    arguments: {
      id: "mcp-co",
      changes: { country: "France" },
      expectedRevision: current.revision,
    },
  });
  assert.equal(stale.isError, true);
  assert.equal(stale.structuredContent.error.status, 409);
  const activity = value(
    await client.callTool({
      name: "log_contact_activity",
      arguments: {
        contactId: "mcp-person",
        activity: {
          type: "Reply received",
          date: "2026-11-13",
          status: "Closed",
          note: "Unavailable this quarter.",
        },
        expectedRevision: updated.revision,
      },
    }),
  );
  assert.equal(activity.data.status, "Closed");
  assert.equal(activity.data.replyDate, "2026-11-13");
  assert.equal(activity.data.activities[0].status, "Closed");
  const company = value(
    await client.callTool({ name: "get_company", arguments: { id: "mcp-co" } }),
  );
  assert.equal(company.data.country, "Algeria");
});
test("MCP failures do not mutate data and return useful tool errors", async () => {
  const before = (await readWorkspace()).revision;
  const missing = await client.callTool({
    name: "get_contact",
    arguments: { id: "missing" },
  });
  assert.equal(missing.isError, true);
  assert.equal(missing.structuredContent.error.status, 404);
  const invalid = await client.callTool({
    name: "log_contact_activity",
    arguments: {
      contactId: "mcp-person",
      activity: { type: "Note", date: "2026-02-30", status: "Warm" },
    },
  });
  assert.equal(invalid.isError, true);
  const relation = await client.callTool({
    name: "create_contact",
    arguments: { name: "Invalid company", companyId: "missing" },
  });
  assert.equal(relation.isError, true);
  assert.equal(relation.structuredContent.error.status, 422);
  const duplicate = await client.callTool({
    name: "create_company",
    arguments: { id: "mcp-co", name: "Duplicate" },
  });
  assert.equal(duplicate.isError, true);
  assert.equal(duplicate.structuredContent.error.status, 409);
  assert.equal((await readWorkspace()).revision, before);
});
test("REST uses the same bearer token and sees MCP mutations without browser login credentials", async () => {
  const response = await recordRoutes("contacts").get(
    new Request("http://localhost/api/contacts/mcp-person", {
      headers: { Authorization: `Bearer ${token}` },
    }),
    { params: Promise.resolve({ id: "mcp-person" }) },
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.role, "CTO");
  assert.equal(
    (
      await recordRoutes("contacts").list(
        new Request("http://localhost/api/contacts", {
          headers: { Authorization: "Bearer invalid" },
        }),
      )
    ).status,
    401,
  );
});
test("rotating the integration key immediately rejects the old bearer token", async () => {
  process.env.CRM_API_TOKEN =
    "replacement-mcp-token-with-more-than-32-characters";
  assert.equal(
    (
      await handleMcpRequest(
        request("POST", { Authorization: `Bearer ${token}` }),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await handleMcpRequest(
        request("GET", {
          Authorization: `Bearer ${process.env.CRM_API_TOKEN}`,
        }),
      )
    ).status,
    405,
  );
  process.env.CRM_API_TOKEN = token;
});
