import { test } from "node:test";
import assert from "node:assert/strict";
import { removeLegacySeedRecords } from "../src/lib/legacy-seed-cleanup.js";
import { normalizeClientWorkspace } from "../src/lib/crm-data.js";
import {
  normalizeWorkspace,
  emptyWorkspace,
} from "../src/server/validation.js";
import { workspaceFixture } from "./helpers/workspace-fixture.mjs";

function oldWorkspace() {
  const real = workspaceFixture();
  return {
    ...real,
    demo: true,
    companies: [
      ...real.companies,
      { ...real.companies[0], id: "co1", name: "Forma" },
    ],
    contacts: [
      ...real.contacts,
      {
        ...real.contacts[0],
        id: "p1",
        name: "Sophie Laurent",
        companyId: "co1",
      },
      {
        ...real.contacts[0],
        id: "real-person",
        name: "Actual person",
        companyId: "co1",
        notes: "Keep this note",
      },
    ],
  };
}
test("fresh workspaces contain no seed contacts or companies", () => {
  const empty = emptyWorkspace();
  assert.deepEqual(empty.contacts, []);
  assert.deepEqual(empty.companies, []);
  assert.equal(empty.demo, false);
});
test("cleanup removes only known demo identities and preserves real data/profile", () => {
  const original = oldWorkspace();
  const before = structuredClone(original);
  const cleaned = removeLegacySeedRecords(original);
  assert.equal(cleaned.contacts.length, 2);
  assert.equal(cleaned.companies.length, 1);
  assert.deepEqual(cleaned.profile, original.profile);
  assert.equal(
    cleaned.contacts.find((c) => c.id === "real-person").notes,
    "Keep this note",
  );
  assert.equal(
    cleaned.contacts.find((c) => c.id === "real-person").companyId,
    "",
  );
  assert.deepEqual(
    cleaned.contacts.find((c) => c.id === "fixture-person"),
    original.contacts[0],
  );
  assert.equal(cleaned.demo, false);
  assert.deepEqual(original, before);
  assert.deepEqual(removeLegacySeedRecords(cleaned), cleaned);
});
test("reused IDs and names alone do not identify a demo record", () => {
  const real = workspaceFixture();
  real.contacts = [
    { ...real.contacts[0], id: "p1", name: "Actual client" },
    { ...real.contacts[0], id: "genuine-id", name: "Sophie Laurent" },
  ];
  real.companies = [
    { ...real.companies[0], id: "co1", name: "Actual company" },
  ];
  assert.equal(removeLegacySeedRecords(real).contacts.length, 2);
  assert.equal(removeLegacySeedRecords(real).companies.length, 1);
});
test("browser migration and server backup imports cannot restore old demo records", () => {
  for (const normalize of [normalizeClientWorkspace, normalizeWorkspace]) {
    const cleaned = normalize(oldWorkspace());
    assert.equal(
      cleaned.contacts.some((c) => c.id === "p1"),
      false,
    );
    assert.equal(
      cleaned.companies.some((c) => c.id === "co1"),
      false,
    );
    assert.equal(cleaned.contacts.length, 2);
  }
  assert.throws(
    () => normalizeWorkspace({ ...emptyWorkspace(), companies: [{}] }),
    (error) => error.status === 422,
  );
});
