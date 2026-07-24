"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Maximize,
  Minimize,
  Moon,
  Play,
  RotateCcw,
  Sun,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { CodeStudioFiles, CodeStudioPrefs, CodeStudioProject } from "@/lib/jnv/code-studio/types";
import { BLANK_FILES } from "@/lib/jnv/code-studio/types";
import { getCodeStudioLanguage } from "@/lib/jnv/code-studio/languages";
import { getDraft, saveDraft, deleteDraft, getPrefs, savePrefs } from "@/lib/jnv/code-studio/local-store";
import { CodeEditorPane, type CodeEditorFileType } from "@/components/jnv/code-studio/code-editor-pane";
import { LivePreview, type ConsoleEntry } from "@/components/jnv/code-studio/live-preview";
import { usePythonRuntime } from "@/components/jnv/code-studio/use-python-runtime";
import { MentorChat } from "@/components/jnv/code-studio/mentor-chat";

const WEB_TABS: { key: CodeEditorFileType; label: string; accent: string }[] = [
  { key: "html", label: "index.html", accent: "text-orange-600 dark:text-orange-400" },
  { key: "css", label: "style.css", accent: "text-sky-600 dark:text-sky-400" },
  { key: "js", label: "script.js", accent: "text-amber-600 dark:text-amber-400" },
];

const FONT_SIZES = [12, 13, 14, 16, 18, 20];

let consoleIdCounter = 0;
function nextConsoleId(): string {
  consoleIdCounter += 1;
  return `l${consoleIdCounter}`;
}

export function EditorWorkspace({ project, onExit }: { project: CodeStudioProject; onExit: () => void }) {
  const language = getCodeStudioLanguage(project.language)!;
  const isWeb = language.runtime === "web";

  const [files, setFiles] = useState<CodeStudioFiles>(() => {
    const draft = getDraft(project.id);
    return { ...BLANK_FILES, ...project.files, ...(draft?.files ?? {}) };
  });
  const [previewFiles, setPreviewFiles] = useState(files);
  const [activeFile, setActiveFile] = useState<CodeEditorFileType>(isWeb ? "html" : "py");
  const [prefs, setPrefs] = useState<CodeStudioPrefs>(() => getPrefs());
  const [logEntries, setLogEntries] = useState<ConsoleEntry[]>([]);
  const [mentorOpen, setMentorOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pyRunning, setPyRunning] = useState(false);
  const filesRef = useRef(files);
  filesRef.current = files;
  const containerRef = useRef<HTMLDivElement>(null);
  const { status: pyStatus, run: runPython } = usePythonRuntime();

  // Debounced preview rebuild — avoids re-rendering the iframe on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setPreviewFiles(files), 400);
    return () => clearTimeout(t);
  }, [files]);

  // Fresh page load in the preview means fresh console output.
  useEffect(() => {
    if (isWeb) setLogEntries([]);
  }, [previewFiles, isWeb]);

  // Local-only autosave — see lib/jnv/code-studio/local-store.ts.
  useEffect(() => {
    const t = setTimeout(() => saveDraft(project.id, project.language, files), 800);
    return () => clearTimeout(t);
  }, [files, project.id, project.language]);

  useEffect(() => {
    const onFsChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function updateFile(key: CodeEditorFileType, value: string) {
    setFiles((prev) => ({ ...prev, [key]: value }));
  }

  function updatePrefs(next: Partial<CodeStudioPrefs>) {
    setPrefs((prev) => {
      const merged = { ...prev, ...next };
      savePrefs(merged);
      return merged;
    });
  }

  function handleReset() {
    const starter = { ...BLANK_FILES, ...project.files };
    setFiles(starter);
    deleteDraft(project.id);
    setLogEntries([]);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen?.();
  }

  const handleConsoleEntry = useCallback((entry: ConsoleEntry) => {
    setLogEntries((prev) => [...prev.slice(-99), entry]);
  }, []);

  async function handleRunPython() {
    if (pyRunning) return;
    setPyRunning(true);
    setLogEntries([]);
    try {
      const result = await runPython(files.py);
      const entries: ConsoleEntry[] = [];
      if (result.output.trim()) {
        for (const line of result.output.split("\n")) {
          if (line) entries.push({ id: nextConsoleId(), type: "log", text: line });
        }
      }
      if (result.error) entries.push({ id: nextConsoleId(), type: "error", text: result.error });
      if (entries.length === 0) entries.push({ id: nextConsoleId(), type: "log", text: "(no output)" });
      setLogEntries(entries);
    } finally {
      setPyRunning(false);
    }
  }

  const consoleOutputSummary = useMemo(
    () => logEntries.map((e) => (e.type === "error" ? `Error: ${e.text}` : e.text)).join("\n"),
    [logEntries],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col gap-3 rounded-2xl",
        fullscreen && "h-dvh bg-slate-50 p-3 dark:bg-slate-950",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <Button variant="ghost" size="sm" onClick={onExit} className="gap-1.5 text-slate-600 dark:text-slate-300">
          <ArrowLeft className="size-4" /> Studio
        </Button>
        <span className="hidden h-5 w-px bg-slate-200 sm:block dark:bg-slate-700" />
        <h1 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{project.title}</h1>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {!isWeb && (
            <Button
              size="sm"
              onClick={handleRunPython}
              disabled={pyStatus === "loading" || pyRunning}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <Play className="size-3.5" />
              {pyStatus === "loading" ? "Loading Python…" : pyRunning ? "Running…" : "Run"}
            </Button>
          )}

          <Select value={String(prefs.fontSize)} onValueChange={(v) => updatePrefs({ fontSize: Number(v) })}>
            <SelectTrigger size="sm" className="w-[84px]" aria-label="Font size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon-sm"
            aria-label={prefs.theme === "dark" ? "Switch to light editor theme" : "Switch to dark editor theme"}
            onClick={() => updatePrefs({ theme: prefs.theme === "dark" ? "light" : "dark" })}
          >
            {prefs.theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Reset project">
                <RotateCcw className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset this project?</AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes your saved progress on this device for &quot;{project.title}&quot; and restores the
                  original starter code. This can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button variant="outline" size="icon-sm" aria-label="Toggle fullscreen" onClick={toggleFullscreen}>
            {fullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </Button>

          <Button size="sm" onClick={() => setMentorOpen(true)} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
            <Bot className="size-4" /> Mentor
          </Button>
        </div>
      </div>

      <p className="px-1 text-xs text-slate-500 dark:text-slate-500">
        Saved to this browser only — nothing is uploaded to a server, and it won&apos;t appear on another device.
      </p>

      <div className={cn("grid gap-3 lg:grid-cols-2", fullscreen && "min-h-0 flex-1")}>
        <div
          className={cn(
            "flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
            fullscreen ? "h-full" : "h-[55vh] lg:h-[calc(100vh-260px)]",
          )}
        >
          {isWeb ? (
            <div className="flex shrink-0 border-b border-slate-200 dark:border-slate-800">
              {WEB_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFile(tab.key)}
                  className={cn(
                    "border-b-2 px-3.5 py-2 text-xs font-semibold transition-colors",
                    activeFile === tab.key
                      ? cn("border-current", tab.accent)
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex shrink-0 items-center border-b border-slate-200 px-3.5 py-2 text-xs font-semibold text-emerald-600 dark:border-slate-800 dark:text-emerald-400">
              main.py
            </div>
          )}
          <div className="min-h-0 flex-1">
            <CodeEditorPane
              fileType={activeFile}
              value={files[activeFile] ?? ""}
              onChange={(value) => updateFile(activeFile, value)}
              theme={prefs.theme}
              fontSize={prefs.fontSize}
              ariaLabel={isWeb ? `${activeFile} editor` : "Python editor"}
            />
          </div>
        </div>

        <div
          className={cn(
            "flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
            fullscreen ? "h-full" : "h-[55vh] lg:h-[calc(100vh-260px)]",
          )}
        >
          {isWeb ? (
            <>
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3.5 py-2 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Live Preview</span>
                {logEntries.length > 0 && (
                  <Button variant="ghost" size="icon-sm" aria-label="Clear console" onClick={() => setLogEntries([])}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
              <div className="min-h-0 flex-1">
                <LivePreview
                  html={previewFiles.html}
                  css={previewFiles.css}
                  js={previewFiles.js}
                  onConsoleEntry={handleConsoleEntry}
                />
              </div>
              {logEntries.length > 0 && <ConsolePanel entries={logEntries} className="max-h-32 shrink-0" />}
            </>
          ) : (
            <>
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3.5 py-2 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Console Output</span>
                {logEntries.length > 0 && (
                  <Button variant="ghost" size="icon-sm" aria-label="Clear console" onClick={() => setLogEntries([])}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
              <ConsolePanel
                entries={logEntries}
                empty="Press Run to execute your Python code. Output (from print()) shows up here."
                className="flex-1"
              />
            </>
          )}
        </div>
      </div>

      <Sheet open={mentorOpen} onOpenChange={setMentorOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col border-slate-200 bg-white p-0 text-slate-900 sm:max-w-md dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        >
          <SheetHeader className="border-b border-slate-200 dark:border-slate-800">
            <SheetTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Bot className="size-5 text-indigo-600" /> Code Mentor
            </SheetTitle>
            <SheetDescription>Session-only — never saved once you close this panel.</SheetDescription>
          </SheetHeader>
          <MentorChat
            language={project.language}
            getCode={() => filesRef.current[activeFile] ?? ""}
            getConsoleOutput={() => consoleOutputSummary}
            className="flex-1"
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ConsolePanel({
  entries,
  empty = "No output yet.",
  className,
}: {
  entries: ConsoleEntry[];
  empty?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-y-auto bg-slate-950 p-2.5 font-mono text-xs", className)}>
      {entries.length === 0 ? (
        <p className="p-1 text-slate-500">{empty}</p>
      ) : (
        entries.map((e) => (
          <p
            key={e.id}
            className={cn(
              "whitespace-pre-wrap break-words px-1 py-0.5",
              e.type === "error" && "text-red-400",
              e.type === "warn" && "text-amber-300",
              e.type === "log" && "text-slate-200",
            )}
          >
            {e.type === "error" ? "✕ " : e.type === "warn" ? "⚠ " : "› "}
            {e.text}
          </p>
        ))
      )}
    </div>
  );
}
