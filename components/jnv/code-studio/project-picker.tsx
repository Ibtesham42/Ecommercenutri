"use client";

import { useEffect, useState } from "react";
import { Code2, FileCode, Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CODE_STUDIO_LANGUAGES } from "@/lib/jnv/code-studio/languages";
import { getCodeStudioProjectsForLanguage } from "@/lib/jnv/code-studio/projects";
import { getLastProjectId, getDraft } from "@/lib/jnv/code-studio/local-store";
import { resolveCodeStudioProject } from "@/lib/jnv/code-studio/resolve-project";
import type { CodeStudioLanguageId } from "@/lib/jnv/code-studio/types";

const ACCENT_CLASSES: Record<string, { badge: string; ring: string }> = {
  orange: { badge: "bg-orange-500/10 text-orange-700 dark:text-orange-400", ring: "hover:border-orange-300 dark:hover:border-orange-800" },
  sky: { badge: "bg-sky-500/10 text-sky-700 dark:text-sky-400", ring: "hover:border-sky-300 dark:hover:border-sky-800" },
  amber: { badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400", ring: "hover:border-amber-300 dark:hover:border-amber-800" },
  emerald: { badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", ring: "hover:border-emerald-300 dark:hover:border-emerald-800" },
};

/**
 * The Code Studio's hub: pick a language, then a starter project (or a blank
 * canvas). Reads localStorage on mount only (never during SSR) to offer a
 * "Continue where you left off" card — this whole module has no server-side
 * project state to fetch.
 */
export function ProjectPicker({ onOpenProject }: { onOpenProject: (projectId: string) => void }) {
  const [activeLanguage, setActiveLanguage] = useState<CodeStudioLanguageId>("html");
  const [lastProject, setLastProject] = useState<{ id: string; title: string; language: string } | null>(null);

  useEffect(() => {
    const lastId = getLastProjectId();
    if (!lastId) return;
    const draft = getDraft(lastId);
    const project = resolveCodeStudioProject(lastId);
    if (draft && project) setLastProject({ id: project.id, title: project.title, language: project.language });
  }, []);

  const projects = getCodeStudioProjectsForLanguage(activeLanguage);

  return (
    <div className="space-y-8">
      {lastProject && (
        <button
          type="button"
          onClick={() => onOpenProject(lastProject.id)}
          className="flex w-full items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-left transition-colors hover:bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white">
            <Play className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-indigo-900 dark:text-indigo-200">
              Continue &quot;{lastProject.title}&quot;
            </span>
            <span className="block text-xs text-indigo-700/80 dark:text-indigo-400/80">
              Pick up right where you left off, saved on this device
            </span>
          </span>
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        {CODE_STUDIO_LANGUAGES.map((lang) => {
          const accent = ACCENT_CLASSES[lang.accent];
          const active = activeLanguage === lang.id;
          return (
            <button
              key={lang.id}
              type="button"
              onClick={() => setActiveLanguage(lang.id)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                active
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : cn("border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300", accent.ring),
              )}
            >
              {lang.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          onClick={() => onOpenProject(`blank-${activeLanguage}`)}
          className="flex flex-col items-start gap-2 rounded-2xl border-2 border-dashed border-slate-300 p-5 text-left transition-colors hover:border-indigo-400 dark:border-slate-700 dark:hover:border-indigo-700"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <Sparkles className="size-5" />
          </span>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Blank Project</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Start from an empty canvas</span>
        </button>

        {projects.map((project) => {
          const accent = ACCENT_CLASSES[CODE_STUDIO_LANGUAGES.find((l) => l.id === project.language)!.accent];
          return (
            <button
              key={project.id}
              type="button"
              onClick={() => onOpenProject(project.id)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900",
                accent.ring,
              )}
            >
              <span className={cn("grid size-10 place-items-center rounded-xl", accent.badge)}>
                <FileCode className="size-5" />
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{project.title}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{project.description}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        <Code2 className="mt-0.5 size-4 shrink-0" />
        <p>
          Everything you write here stays in this browser only — nothing is uploaded to a server or saved to your
          account. Clearing your browser data (or switching devices) starts fresh.
        </p>
      </div>
    </div>
  );
}
