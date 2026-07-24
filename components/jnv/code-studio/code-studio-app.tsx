"use client";

import { useState } from "react";
import { resolveCodeStudioProject } from "@/lib/jnv/code-studio/resolve-project";
import { ProjectPicker } from "@/components/jnv/code-studio/project-picker";
import { EditorWorkspace } from "@/components/jnv/code-studio/editor-workspace";

/**
 * Top-level client shell for `/jnv/code-studio` — owns hub-vs-editor
 * navigation as plain React state rather than routes/query params, since
 * there's no server state to deep-link into anyway (everything lives in
 * this browser's localStorage). Mounted from a server page.tsx that only
 * carries metadata.
 */
export function CodeStudioApp() {
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const project = openProjectId ? resolveCodeStudioProject(openProjectId) : null;

  if (project) {
    return <EditorWorkspace key={project.id} project={project} onExit={() => setOpenProjectId(null)} />;
  }

  return <ProjectPicker onOpenProject={setOpenProjectId} />;
}
