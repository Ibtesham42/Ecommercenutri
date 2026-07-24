/**
 * Shared types for the JNV Code Studio — a from-scratch module living
 * alongside the existing Notes Portal under `/jnv`. Everything here is
 * client-safe (no server-only imports) since the whole studio runs without
 * any server-side project storage: code never leaves the browser except as
 * ephemeral context in an AI mentor request.
 */

export type CodeStudioRuntime = "web" | "python";

export type CodeStudioLanguageId = "html" | "css" | "javascript" | "python";

export type CodeStudioLanguage = {
  id: CodeStudioLanguageId;
  label: string;
  runtime: CodeStudioRuntime;
  /** Tailwind color token stem used for badges/accents (e.g. "orange" -> bg-orange-500/10). */
  accent: string;
};

/** The full set of source files a project can carry. Web projects use
 *  html/css/js together (like a real playground); Python projects use only `py`. */
export type CodeStudioFiles = {
  html: string;
  css: string;
  js: string;
  py: string;
};

export const BLANK_FILES: CodeStudioFiles = { html: "", css: "", js: "", py: "" };

export type CodeStudioProject = {
  id: string;
  language: CodeStudioLanguageId;
  title: string;
  description: string;
  files: Partial<CodeStudioFiles>;
};

export type CodeStudioPrefs = {
  theme: "light" | "dark";
  fontSize: number;
};

export const DEFAULT_PREFS: CodeStudioPrefs = { theme: "light", fontSize: 14 };
