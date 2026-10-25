import { api } from "../api";

const TTL = 5 * 60 * 1000;
const STORAGE = "protektor-navigation-v1";
const memory = new Map();
const pending = new Map();
export const navigationIdentity = (me) => me ? JSON.stringify([me.user_id ?? me.id, me.company_id, me.company_name, me.role_id, me.role_name, me.is_admin]) : null;
const valid = (data) => data && typeof data.classic_href === "string" && Array.isArray(data.sections) && data.sections.every((s) =>
  typeof s.key === "string" && typeof s.label === "string" && Array.isArray(s.items) && s.items.length > 0 && s.items.every((i) => typeof i.key === "string" && typeof i.label === "string" && /^\/(v2|gui)(\/|$)/.test(i.href)));

export function cachedNavigation(identity) {
  if (!identity) return null;
  let entry = memory.get(identity);
  if (!entry) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE));
      if (saved?.identity === identity) entry = saved;
    } catch { /* Storage can be unavailable in a WebView. */ }
  }
  if (entry && entry.expires > Date.now() && valid(entry.data)) {
    memory.set(identity, entry);
    return entry.data;
  }
  return null;
}

export function loadNavigation(identity) {
  const cached = cachedNavigation(identity);
  if (cached) return Promise.resolve(cached);
  if (!pending.has(identity)) {
    const request = api.navigation().then((data) => {
      if (!valid(data)) throw new Error("Navegación inválida");
      const entry = { identity, data, expires: Date.now() + TTL };
      memory.set(identity, entry);
      try { sessionStorage.setItem(STORAGE, JSON.stringify(entry)); } catch { /* Optional cache. */ }
      return data;
    }).finally(() => pending.delete(identity));
    pending.set(identity, request);
  }
  return pending.get(identity);
}
