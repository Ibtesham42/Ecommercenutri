"use client";

import { Bot } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useJnvPresentation } from "@/components/jnv/presentation-provider";
import { useJnvAiContext } from "@/components/jnv/ai-context-provider";
import { JnvAiChat } from "@/components/jnv/jnv-ai-chat";

/**
 * Global floating launcher for Byte, mounted once in app/jnv/layout.tsx so
 * it's reachable from every student-portal page, including inside
 * Presentation Mode (a teacher may want to pull up a quiz mid-lesson).
 * Deliberately NOT marked `jnv-chrome` for that reason. Open state and any
 * resource context come from `JnvAiContextProvider`, so `ResourceViewer` can
 * trigger "Ask Byte about this" without prop-drilling.
 */
export function JnvAiLauncher() {
  const { active: presentation } = useJnvPresentation();
  const { open, setOpen, payload, openGeneral } = useJnvAiContext();

  return (
    <>
      <button
        type="button"
        onClick={openGeneral}
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-elev-2 transition-transform hover:bg-blue-700 active:scale-95 print:hidden"
      >
        <Bot className="size-5" />
        <span className={presentation ? "sr-only" : ""}>Ask Byte</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col border-slate-200 bg-white p-0 text-slate-900 sm:max-w-md dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        >
          <SheetHeader className="border-b border-slate-200 dark:border-slate-800">
            <SheetTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Bot className="size-5 text-blue-600" /> Byte — CS Teaching Assistant
            </SheetTitle>
            <SheetDescription>For Classes 6–10 · explanations, quizzes, worksheets and more</SheetDescription>
          </SheetHeader>
          <JnvAiChat
            key={payload?.resourceId ?? "general"}
            className="flex-1"
            resourceContext={payload}
            initialQuestion={payload?.initialQuestion}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
