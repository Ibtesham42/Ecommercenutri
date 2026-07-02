/**
 * Guest recent-search history — localStorage, newest first, capped. Mirrors the
 * `recently-viewed.tsx` pattern. Logged-in users get the same list synced to
 * their account via `lib/actions/search.ts`; the overlay writes to both so a
 * later login/logout never loses the local trail. All functions are safe to
 * call on the server (no-op) and swallow quota/JSON errors.
 */

const KEY = "nutriyet-recent-searches";
export const MAX_RECENT_SEARCHES = 8;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function write(list: string[]): string[] {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* quota/private mode — history just won't persist */
    }
  }
  return list;
}

export function getRecentSearches(): string[] {
  return read();
}

export function addRecentSearch(term: string): string[] {
  const t = term.trim().slice(0, 60);
  if (!t) return read();
  const rest = read().filter((x) => x.toLowerCase() !== t.toLowerCase());
  return write([t, ...rest].slice(0, MAX_RECENT_SEARCHES));
}

export function removeRecentSearch(term: string): string[] {
  return write(read().filter((x) => x.toLowerCase() !== term.toLowerCase()));
}

export function clearRecentSearches(): void {
  write([]);
}
