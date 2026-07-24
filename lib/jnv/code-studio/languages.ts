import type { CodeStudioLanguage, CodeStudioLanguageId } from "@/lib/jnv/code-studio/types";

/**
 * The 4 initial languages. Adding a new one later means: an entry here, a
 * starter/project set in `projects.ts`, and — only if it needs a genuinely
 * new execution model beyond "web" (HTML/CSS/JS) or "python" — a new runner
 * alongside `use-python-runtime.ts`. Web-family languages (HTML/CSS/JS) all
 * share one live-preview runtime since real pages mix all three.
 */
export const CODE_STUDIO_LANGUAGES: CodeStudioLanguage[] = [
  { id: "html", label: "HTML", runtime: "web", accent: "orange" },
  { id: "css", label: "CSS", runtime: "web", accent: "sky" },
  { id: "javascript", label: "JavaScript", runtime: "web", accent: "amber" },
  { id: "python", label: "Python", runtime: "python", accent: "emerald" },
];

export function getCodeStudioLanguage(id: string): CodeStudioLanguage | undefined {
  return CODE_STUDIO_LANGUAGES.find((l) => l.id === id);
}

export function isCodeStudioLanguageId(value: unknown): value is CodeStudioLanguageId {
  return CODE_STUDIO_LANGUAGES.some((l) => l.id === value);
}
