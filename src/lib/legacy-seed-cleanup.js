// Legacy identifiers are used only to remove demo records from old workspaces.
// Matching both ID and name avoids deleting real records that reuse an old ID.
const demoCompanies = new Map([
  ["co1", "Forma"],
  ["co2", "Layers"],
  ["co3", "Orbit"],
  ["co4", "Mintlify Studio"],
  ["co5", "Parallel"],
]);
const demoContacts = new Map([
  ["p1", "Sophie Laurent"],
  ["p2", "James Wilson"],
  ["p3", "Lina Haddad"],
  ["p4", "Alex Morgan"],
  ["p5", "Omar Benali"],
  ["p6", "Emma Chen"],
]);

export function removeLegacySeedRecords(data) {
  if (!data || !Array.isArray(data.companies) || !Array.isArray(data.contacts))
    return data;
  const removedCompanies = new Set(
    data.companies
      .filter(
        (c) =>
          c && demoCompanies.has(c.id) && demoCompanies.get(c.id) === c.name,
      )
      .map((c) => c.id),
  );
  return {
    ...data,
    demo: false,
    companies: data.companies.filter((c) => !c || !removedCompanies.has(c.id)),
    contacts: data.contacts
      .filter(
        (c) =>
          !c || !demoContacts.has(c.id) || demoContacts.get(c.id) !== c.name,
      )
      .map((c) =>
        c && removedCompanies.has(c.companyId) ? { ...c, companyId: "" } : c,
      ),
  };
}
