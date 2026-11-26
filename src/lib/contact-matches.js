export function contactKeys(contact) {
  const keys = [];
  const email = contact.email?.trim().toLowerCase();
  if (email) keys.push(`email:${email}`);
  if (!contact.linkedin) return keys;
  try {
    const { hostname, pathname } = new URL(contact.linkedin);
    if (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")) {
      const profile = /^\/in\/([^/]+)(?:\/|$)/i.exec(pathname);
      if (profile)
        keys.push(`linkedin:${decodeURIComponent(profile[1]).toLowerCase()}`);
      else if (/^\/pub\/[^/]+\//i.test(pathname))
        keys.push(
          `linkedin:${decodeURIComponent(pathname).toLowerCase().replace(/\/+$/, "")}`,
        );
    }
  } catch {
    // Empty or invalid links have no identity key.
  }
  return keys;
}

export function indexContacts(contacts) {
  const index = new Map();
  for (const contact of contacts) {
    for (const key of contactKeys(contact)) {
      if (!index.has(key)) index.set(key, new Set());
      index.get(key).add(contact.id);
    }
  }
  return index;
}

export function matchingContactIds(index, contact) {
  return new Set(
    contactKeys(contact).flatMap((key) => [...(index.get(key) ?? [])]),
  );
}

export function newContactConflict(before, after, allowed) {
  let previous;
  for (const [key, ids] of indexContacts(after)) {
    if (ids.size < 2) continue;
    previous ??= indexContacts(before);
    const existing = previous.get(key);
    const restored = allowed?.get(key);
    const introduced = [...ids].filter((id) => !existing?.has(id));
    if (!introduced.length) continue;
    if (restored && [...ids].every((id) => restored.has(id))) continue;
    return [...ids];
  }
  return null;
}
