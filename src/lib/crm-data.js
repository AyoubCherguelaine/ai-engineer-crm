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
export const uid = () => crypto.randomUUID();
export const seed = {
  profile: {
    name: "Ayoub",
    title: "AI Engineer",
    portfolio: "",
    cv: "",
    skills: "AI agents, LLM applications, automation",
    looking: "Part-time & collaboration",
    bio: "",
  },
  companies: [
    {
      id: "co1",
      name: "Forma",
      niche: "AI & productivity",
      description:
        "Building thoughtful AI tools that make everyday work simpler.",
      website: "",
      country: "",
      linkedin: "",
      status: "Not checked",
      color: "purple",
    },
    {
      id: "co2",
      name: "Layers",
      niche: "Design & development",
      description:
        "A small product studio turning ambitious ideas into useful products.",
      website: "",
      country: "",
      linkedin: "",
      status: "Not checked",
      color: "orange",
    },
    {
      id: "co3",
      name: "Orbit",
      niche: "Developer tools",
      description:
        "Developer-first infrastructure for modern engineering teams.",
      website: "",
      country: "",
      linkedin: "",
      status: "Not checked",
      color: "blue",
    },
    {
      id: "co4",
      name: "Mintlify Studio",
      niche: "SaaS",
      description:
        "An example early-stage SaaS company to explore for collaboration.",
      website: "",
      country: "",
      linkedin: "",
      status: "Not checked",
      color: "green",
    },
    {
      id: "co5",
      name: "Parallel",
      niche: "AI & automation",
      description:
        "An example automation team working with growing businesses.",
      website: "",
      country: "",
      linkedin: "",
      status: "Not checked",
      color: "pink",
    },
  ],
  contacts: [
    {
      id: "p1",
      name: "Sophie Laurent",
      role: "Co-founder & CEO",
      companyId: "co1",
      email: "",
      linkedin: "",
      status: "Warm",
      temperature: "Warm",
      channel: "LinkedIn",
      lastContact: shiftDate(-1),
      replyDate: shiftDate(-1),
      followUp: shiftDate(0),
      meetingDate: "",
      opportunity: "Collaboration",
      notes:
        "Interested in an AI agent prototype. Share a relevant portfolio project.",
      activities: [
        {
          id: "a1",
          type: "Reply received",
          date: shiftDate(-1),
          note: "Interested in seeing a portfolio project.",
        },
      ],
      color: "purple",
    },
    {
      id: "p2",
      name: "James Wilson",
      role: "CTO",
      companyId: "co3",
      email: "",
      linkedin: "",
      status: "No response",
      temperature: "Cold",
      channel: "Email",
      lastContact: shiftDate(-4),
      replyDate: "",
      followUp: shiftDate(1),
      meetingDate: "",
      opportunity: "Part-time",
      notes:
        "Introduce AI engineering experience and ask about part-time opportunities.",
      activities: [],
      color: "blue",
    },
    {
      id: "p3",
      name: "Lina Haddad",
      role: "Founder",
      companyId: "co2",
      email: "",
      linkedin: "",
      status: "Meeting",
      temperature: "Warm",
      channel: "LinkedIn",
      lastContact: shiftDate(-2),
      replyDate: shiftDate(-1),
      followUp: "",
      meetingDate: shiftDate(2),
      opportunity: "Collaboration",
      notes: "Discuss a potential automation project for the studio.",
      activities: [],
      color: "orange",
    },
    {
      id: "p4",
      name: "Alex Morgan",
      role: "Head of Engineering",
      companyId: "co4",
      email: "",
      linkedin: "",
      status: "To reach out",
      temperature: "Cold",
      channel: "LinkedIn",
      lastContact: "",
      replyDate: "",
      followUp: "",
      meetingDate: "",
      opportunity: "Part-time",
      notes: "",
      activities: [],
      color: "green",
    },
    {
      id: "p5",
      name: "Omar Benali",
      role: "Co-founder & CTO",
      companyId: "co5",
      email: "",
      linkedin: "",
      status: "No response",
      temperature: "Cold",
      channel: "LinkedIn",
      lastContact: shiftDate(-6),
      replyDate: "",
      followUp: shiftDate(-1),
      meetingDate: "",
      opportunity: "Collaboration",
      notes: "Follow up with a short example of an automation workflow.",
      activities: [],
      color: "pink",
    },
    {
      id: "p6",
      name: "Emma Chen",
      role: "Product Lead",
      companyId: "co1",
      email: "",
      linkedin: "",
      status: "To reach out",
      temperature: "Cold",
      channel: "Email",
      lastContact: "",
      replyDate: "",
      followUp: "",
      meetingDate: "",
      opportunity: "Part-time",
      notes: "",
      activities: [],
      color: "teal",
    },
  ],
  demo: true,
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

export function normalizeClientWorkspace(data) {
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
