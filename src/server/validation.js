import { z } from "zod";
import { statuses, seed } from "../lib/crm-data.js";
import { ApiError } from "./errors.js";

const text = z.string().max(20000);
const name = z.string().trim().min(1).max(200);
const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/);
const url = z
  .string()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Use a full http:// or https:// URL.");
const date = z
  .string()
  .refine(
    (value) =>
      !value ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value),
    "Use a valid date in YYYY-MM-DD format.",
  );
const activity = z
  .object({
    id,
    type: z.enum([
      "Message sent",
      "Reply received",
      "Meeting scheduled",
      "Note",
    ]),
    date: date.refine(Boolean, "Activity date is required."),
    note: text,
    status: z.enum(statuses).optional(),
  })
  .strict();
export const recordId = id;
export const activityLog = activity
  .omit({ id: true })
  .extend({ status: z.enum(statuses), note: text.default("") })
  .strict();
const companyShape = {
  name,
  niche: text,
  description: text,
  website: url,
  linkedin: url,
  country: z.string().trim().max(200),
  color: z.enum(["purple", "orange", "blue", "green", "pink", "teal"]),
  status: z.enum(statuses),
};
const contactShape = {
  name,
  role: text,
  companyId: z.union([z.literal(""), id]),
  email: z.union([z.literal(""), z.email()]),
  linkedin: url,
  status: z.enum(statuses),
  temperature: z.enum(["Cold", "Warm"]),
  channel: z.enum(["LinkedIn", "Email", "Other"]),
  lastContact: date,
  replyDate: date,
  followUp: date,
  meetingDate: date,
  opportunity: z.enum(["Part-time", "Collaboration", "Freelance", "Full-time"]),
  notes: text,
  activities: z.array(activity).max(10000),
  color: companyShape.color,
};
export const companyDefaults = {
  niche: "",
  description: "",
  website: "",
  linkedin: "",
  country: "",
  color: "green",
  status: "Not checked",
};
export const contactDefaults = {
  role: "",
  companyId: "",
  email: "",
  linkedin: "",
  status: "Not checked",
  temperature: "Cold",
  channel: "LinkedIn",
  lastContact: "",
  replyDate: "",
  followUp: "",
  meetingDate: "",
  opportunity: "Part-time",
  notes: "",
  activities: [],
  color: "purple",
};
export const companyCreate = z
  .object({ ...companyShape, id })
  .partial()
  .extend({ name })
  .strict();
export const contactCreate = z
  .object({ ...contactShape, id })
  .partial()
  .extend({ name })
  .strict();
export const companyPatch = z
  .object(companyShape)
  .partial()
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Supply at least one field to update.",
  );
export const contactPatch = z
  .object(contactShape)
  .partial()
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Supply at least one field to update.",
  );
const workspaceSchema = z
  .object({
    profile: z
      .object({
        name,
        title: text,
        portfolio: url,
        cv: url,
        skills: text,
        looking: z.enum([
          "Part-time & collaboration",
          "Part-time",
          "Collaboration",
          "Freelance",
          "Full-time",
        ]),
        bio: text,
      })
      .strict(),
    contacts: z.array(z.object({ ...contactShape, id }).strict()).max(50000),
    companies: z.array(z.object({ ...companyShape, id }).strict()).max(50000),
    demo: z.boolean(),
  })
  .strict();
export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(
      422,
      result.error.issues
        .map((issue) => `${issue.path.join(".") || "record"}: ${issue.message}`)
        .join("; "),
    );
  return result.data;
}
export function normalizeWorkspace(value) {
  if (
    !value ||
    !Array.isArray(value.companies) ||
    !Array.isArray(value.contacts)
  )
    throw new ApiError(422, "Invalid workspace backup.");
  const normalized = parse(workspaceSchema, {
    ...value,
    companies: value.companies.map((c) => ({ ...companyDefaults, ...c })),
    contacts: value.contacts.map((c) => ({ ...contactDefaults, ...c })),
  });
  const companies = new Set(normalized.companies.map((c) => c.id));
  const contacts = new Set(normalized.contacts.map((c) => c.id));
  if (
    companies.size !== normalized.companies.length ||
    contacts.size !== normalized.contacts.length
  )
    throw new ApiError(422, "Record IDs must be unique.");
  for (const contact of normalized.contacts) {
    if (contact.companyId && !companies.has(contact.companyId))
      throw new ApiError(422, `Company ${contact.companyId} does not exist.`);
    if (
      new Set(contact.activities.map((a) => a.id)).size !==
      contact.activities.length
    )
      throw new ApiError(422, "Activity IDs must be unique within a contact.");
  }
  return normalized;
}
export function emptyWorkspace() {
  return {
    profile: structuredClone(seed.profile),
    contacts: [],
    companies: [],
    demo: false,
  };
}
