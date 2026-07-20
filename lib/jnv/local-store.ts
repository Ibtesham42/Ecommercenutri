"use client";

/**
 * Client-only "account-free" personalization for the JNV student portal — it
 * has no login, so Favorites and Continue Learning live in localStorage on
 * the student's own device instead of a User-linked DB table.
 */

export type JnvLocalItem = {
  id: string;
  title: string;
  href: string;
  classLevel: number;
  subject: string | null;
  at: number; // epoch ms
};

const RECENT_KEY = "jnv:recent";
const FAVORITES_KEY = "jnv:favorites";
const RECENT_CAP = 8;
const FAVORITES_CAP = 40;

function read(key: string): JnvLocalItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as JnvLocalItem[]) : [];
  } catch {
    return [];
  }
}

function write(key: string, items: JnvLocalItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* storage full or blocked — best-effort feature, ignore */
  }
}

export function getRecent(): JnvLocalItem[] {
  return read(RECENT_KEY);
}

export function addRecent(item: Omit<JnvLocalItem, "at">): void {
  const existing = read(RECENT_KEY).filter((i) => i.id !== item.id);
  const next = [{ ...item, at: Date.now() }, ...existing].slice(0, RECENT_CAP);
  write(RECENT_KEY, next);
}

export function getFavorites(): JnvLocalItem[] {
  return read(FAVORITES_KEY);
}

export function isFavorite(id: string): boolean {
  return read(FAVORITES_KEY).some((i) => i.id === id);
}

export function toggleFavorite(item: Omit<JnvLocalItem, "at">): boolean {
  const existing = read(FAVORITES_KEY);
  const already = existing.some((i) => i.id === item.id);
  const next = already
    ? existing.filter((i) => i.id !== item.id)
    : [{ ...item, at: Date.now() }, ...existing].slice(0, FAVORITES_CAP);
  write(FAVORITES_KEY, next);
  return !already;
}
