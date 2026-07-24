"use client";

import type { CodeStudioFiles, CodeStudioLanguageId, CodeStudioPrefs } from "@/lib/jnv/code-studio/types";
import { DEFAULT_PREFS } from "@/lib/jnv/code-studio/types";

/**
 * ALL Code Studio persistence lives here, and ALL of it is `window.localStorage`
 * — by design, per the module's core constraint: student code is never sent
 * to or stored on any server, database, or cloud storage. Clearing browser
 * storage deletes everything; nothing survives a device switch. Do not add a
 * server-side save path to this module without a deliberate, separate
 * decision — that would silently break the "your code stays on your device"
 * promise shown in the UI.
 */

type DraftEntry = {
  language: CodeStudioLanguageId;
  files: Partial<CodeStudioFiles>;
  updatedAt: number;
};

const DRAFTS_KEY = "jnv:code-studio:drafts";
const PREFS_KEY = "jnv:code-studio:prefs";
const LAST_PROJECT_KEY = "jnv:code-studio:last-project";
const MAX_DRAFTS = 40;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readDrafts(): Record<string, DraftEntry> {
  if (typeof window === "undefined") return {};
  return safeParse(window.localStorage.getItem(DRAFTS_KEY), {});
}

function writeDrafts(drafts: Record<string, DraftEntry>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    /* storage full/blocked — best effort only, never throw into the editor */
  }
}

/** The student's saved progress for one project id, or null if never saved. */
export function getDraft(projectId: string): DraftEntry | null {
  return readDrafts()[projectId] ?? null;
}

/** Upserts a project's draft, evicting the oldest entry once over the cap. */
export function saveDraft(projectId: string, language: CodeStudioLanguageId, files: Partial<CodeStudioFiles>): void {
  const drafts = readDrafts();
  drafts[projectId] = { language, files, updatedAt: Date.now() };

  const ids = Object.keys(drafts);
  if (ids.length > MAX_DRAFTS) {
    const oldest = ids.sort((a, b) => drafts[a].updatedAt - drafts[b].updatedAt)[0];
    delete drafts[oldest];
  }
  writeDrafts(drafts);
  setLastProjectId(projectId);
}

export function deleteDraft(projectId: string): void {
  const drafts = readDrafts();
  delete drafts[projectId];
  writeDrafts(drafts);
}

export function getLastProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_PROJECT_KEY);
}

export function setLastProjectId(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_PROJECT_KEY, projectId);
  } catch {
    /* best effort */
  }
}

export function getPrefs(): CodeStudioPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  return { ...DEFAULT_PREFS, ...safeParse(window.localStorage.getItem(PREFS_KEY), {}) };
}

export function savePrefs(prefs: CodeStudioPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* best effort */
  }
}
