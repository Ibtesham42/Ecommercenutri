"use client";

import { Maximize, Minimize, MonitorPlay, X } from "lucide-react";
import { useJnvPresentation } from "@/components/jnv/presentation-provider";
import { cn } from "@/lib/utils";

/**
 * Always mounted (not `jnv-chrome`) so a teacher can enter/exit Presentation
 * Mode and toggle fullscreen from any student-portal page, including while
 * every other nav element is hidden.
 */
export function JnvPresentationControls() {
  const { active, toggle, enterFullscreen, fullscreen } = useJnvPresentation();

  if (!active) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2.5 text-sm font-medium text-slate-600 shadow-elev-2 backdrop-blur transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:text-blue-300 print:hidden"
      >
        <MonitorPlay className="size-4" />
        <span className="hidden sm:inline">Presentation Mode</span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed right-4 top-4 z-50 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 p-1.5 shadow-elev-2 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 print:hidden",
      )}
    >
      <button
        type="button"
        onClick={enterFullscreen}
        aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        className="grid size-11 place-items-center rounded-full text-slate-600 transition-colors hover:bg-blue-600/10 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300"
      >
        {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
      </button>
      <button
        type="button"
        onClick={toggle}
        className="flex h-11 items-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
      >
        <X className="size-4" /> Exit Presentation
      </button>
    </div>
  );
}
