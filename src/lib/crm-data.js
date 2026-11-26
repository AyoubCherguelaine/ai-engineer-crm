import { removeLegacySeedRecords } from "./legacy-seed-cleanup.js";

export const statuses = [
  "Not checked",
  "To reach out",
  "No response",
  "Warm",
  "Meeting",
  "Closed",
];
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const shiftDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDate(d);
};
export const formatDate = (value) =>
  value
    ? new Date(value + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "—";
export const initials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export function uid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // getRandomValues also works on plain HTTP when the app is opened over LAN.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const defaultProfile = {
  name: "Ayoub",
  title: "AI Engineer",
  portfolio: "",
  cv: "",
  skills: "AI agents, LLM applications, automation",
  looking: "Part-time & collaboration",
  bio: "",
};
export function validateImport(data) {
  if (
    !data ||
    !Array.isArray(data.contacts) ||
    !Array.isArray(data.companies) ||
    !data.profile ||
    typeof data.demo !== "boolean"
  )
    return false;
  const str = (value) => typeof value === "string";
  const fields = (record, keys) =>
    record && keys.every((key) => str(record[key]));
  const validDate = (value) =>
    str(value) &&
    (!value ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value));
  const uniqueIds = (items) =>
    new Set(items.map((item) => item?.id)).size === items.length;
  if (
    !fields(data.profile, [
      "name",
      "title",
      "portfolio",
      "cv",
      "skills",
      "looking",
      "bio",
    ])
  )
    return false;
  return (
    uniqueIds(data.companies) &&
    uniqueIds(data.contacts) &&
    data.companies.every(
      (c) =>
        fields(c, ["id", "name", "niche", "description", "website", "color"]) &&
        ["country", "linkedin"].every(
          (key) => c[key] === undefined || str(c[key]),
        ) &&
        (c.status === undefined || statuses.includes(c.status)) &&
        c.id &&
        c.name.trim(),
    ) &&
    data.contacts.every(
      (c) =>
        fields(c, [
          "id",
          "name",
          "role",
          "companyId",
          "notes",
          "email",
          "linkedin",
          "temperature",
          "channel",
          "opportunity",
          "color",
        ]) &&
        c.id &&
        c.name.trim() &&
        statuses.includes(c.status) &&
        ["Cold", "Warm"].includes(c.temperature) &&
        ["lastContact", "replyDate", "followUp", "meetingDate"].every((key) =>
          validDate(c[key]),
        ) &&
        Array.isArray(c.activities) &&
        uniqueIds(c.activities) &&
        c.activities.every(
          (a) =>
            fields(a, ["id", "type", "note"]) &&
            (a.status === undefined || statuses.includes(a.status)) &&
            a.id &&
            a.date &&
            validDate(a.date),
        ),
    )
  );
}
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeClientWorkspace(value) {
  const data = removeLegacySeedRecords(value);
  return {
    ...data,
    companies: data.companies.map((company) => ({
      country: "",
      linkedin: "",
      status: "Not checked",
      ...company,
    })),
  };
}
