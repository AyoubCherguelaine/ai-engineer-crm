import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError } from "./errors.js";
import { readWorkspace, mutateWorkspace } from "./database.js";
import {
  contactCreate,
  contactPatch,
  contactDefaults,
  parse,
} from "./validation.js";
import {
  contactKeys,
  indexContacts,
  matchingContactIds,
} from "../lib/contact-matches.js";
import { MAX_CONTACT_CSV_SIZE, readCsv } from "../lib/contact-csv.js";

export const contactImportInput = z
  .object({
    csv: z.string().min(1).max(MAX_CONTACT_CSV_SIZE),
    apply: z.boolean().default(false),
  })
  .strict();
const fields = new Map(
  [
    "name",
    ...Object.keys(contactDefaults).filter((key) => key !== "activities"),
  ].map((key) => [key.toLowerCase(), key]),
);

function parseRows(csv) {
  let records;
  try {
    records = readCsv(csv);
  } catch (error) {
    throw new ApiError(422, error.message);
  }
  const [header, ...rows] = records;
  if (!rows.length)
    throw new ApiError(
      422,
      "The CSV needs a header and at least one contact row.",
    );
  const headings = header.fields.map((field) => field.trim().toLowerCase());
  const invalid = headings.find((field) => !fields.has(field));
  if (invalid !== undefined)
    throw new ApiError(422, `Unknown CSV column: ${invalid || "(blank)"}.`);
  if (new Set(headings).size !== headings.length)
    throw new ApiError(422, "CSV column names must be unique.");
  return { rows, keys: headings.map((field) => fields.get(field)) };
}

function planImport(data, { rows, keys }) {
  const index = indexContacts(data.contacts);
  const contacts = new Map(data.contacts.map((record) => [record.id, record]));
  const companies = new Set(data.companies.map(({ id }) => id));
  const usedKeys = new Map();
  const usedIds = new Map();

  return rows.map(({ line, fields }) => {
    const row = Object.fromEntries(
      keys.flatMap((key, i) =>
        fields[i]?.trim() ? [[key, fields[i].trim()]] : [],
      ),
    );
    const summary = {
      line,
      name: row.name || row.email || row.linkedin || "Unnamed contact",
    };
    try {
      if (fields.length !== keys.length)
        throw new ApiError(
          422,
          "The number of values differs from the header.",
        );
      const matches = [...matchingContactIds(index, row)];
      if (matches.length > 1)
        throw new ApiError(
          422,
          "Email and LinkedIn match multiple contacts. Merge or resolve them first.",
        );
      const match = contacts.get(matches[0]);
      const values = parse(match ? contactPatch : contactCreate, row);
      if (values.companyId && !companies.has(values.companyId))
        throw new ApiError(422, `Company ${values.companyId} does not exist.`);
      const identities = contactKeys({ ...match, ...values });
      const earlier =
        usedIds.get(match?.id) ??
        identities.map((key) => usedKeys.get(key)).find(Boolean);
      if (earlier)
        throw new ApiError(
          422,
          `This contact is already represented on line ${earlier}.`,
        );
      if (match) usedIds.set(match.id, line);
      for (const key of identities) usedKeys.set(key, line);
      return {
        ...summary,
        name: values.name ?? match?.name,
        action: match ? "update" : "create",
        ...(match && { id: match.id, existingName: match.name }),
        values,
      };
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      return { ...summary, action: "fix", message: error.message };
    }
  });
}

export async function previewContactImport(csv) {
  const parsed = parseRows(csv);
  const { data, revision } = await readWorkspace();
  const rows = planImport(data, parsed).map(({ values, ...row }) => row);
  return { rows, revision };
}

export async function applyContactImport(csv, revision) {
  const parsed = parseRows(csv);
  return mutateWorkspace((data) => {
    const plan = planImport(data, parsed);
    if (!plan.some(({ action }) => action !== "fix"))
      throw new ApiError(422, "Fix the CSV issues before importing.");
    const updates = new Map(
      plan
        .filter(({ action }) => action === "update")
        .map(({ id, values }) => [id, values]),
    );
    const created = plan
      .filter(({ action }) => action === "create")
      .map(({ values }) => ({
        ...contactDefaults,
        ...values,
        id: randomUUID(),
      }));
    data.contacts = [
      ...created,
      ...data.contacts.map((contact) => ({
        ...contact,
        ...updates.get(contact.id),
      })),
    ];
    return data;
  }, revision);
}
