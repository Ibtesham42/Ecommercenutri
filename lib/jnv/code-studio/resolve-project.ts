import { getCodeStudioProject } from "@/lib/jnv/code-studio/projects";
import { getCodeStudioLanguage, isCodeStudioLanguageId } from "@/lib/jnv/code-studio/languages";
import type { CodeStudioProject } from "@/lib/jnv/code-studio/types";

const BLANK_ID_RE = /^blank-(.+)$/;

/** Resolves a project id to either a catalog project or a synthetic "blank
 *  canvas" project — shared by the hub (to render a "Continue" card for a
 *  blank project too) and the app shell (to open the editor). */
export function resolveCodeStudioProject(projectId: string): CodeStudioProject | null {
  const catalogProject = getCodeStudioProject(projectId);
  if (catalogProject) return catalogProject;

  const blankMatch = BLANK_ID_RE.exec(projectId);
  if (blankMatch && isCodeStudioLanguageId(blankMatch[1])) {
    const language = getCodeStudioLanguage(blankMatch[1])!;
    return {
      id: projectId,
      language: language.id,
      title: `Blank ${language.label} Project`,
      description: "",
      files: {},
    };
  }
  return null;
}
