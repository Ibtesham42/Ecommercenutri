"use client";

import { useMemo } from "react";
import CodeMirror, { type Extension } from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
import { EditorView } from "@codemirror/view";

export type CodeEditorFileType = "html" | "css" | "js" | "py";

const LANGUAGE_EXTENSIONS: Record<CodeEditorFileType, Extension> = {
  html: html(),
  css: css(),
  js: javascript(),
  py: python(),
};

/**
 * Thin CodeMirror 6 wrapper shared by every file pane in the studio. Kept
 * generic on purpose — adding a 5th language later is one more entry in
 * `LANGUAGE_EXTENSIONS` (plus its own `@codemirror/lang-*` package), no
 * changes needed here.
 */
export function CodeEditorPane({
  fileType,
  value,
  onChange,
  theme,
  fontSize,
  readOnly = false,
  ariaLabel,
}: {
  fileType: CodeEditorFileType;
  value: string;
  onChange: (value: string) => void;
  theme: "light" | "dark";
  fontSize: number;
  readOnly?: boolean;
  ariaLabel: string;
}) {
  const extensions = useMemo(
    () => [
      LANGUAGE_EXTENSIONS[fileType],
      EditorView.lineWrapping,
      EditorView.theme({ "&": { fontSize: `${fontSize}px` }, ".cm-scroller": { fontFamily: "var(--font-mono, monospace)" } }),
    ],
    [fileType, fontSize],
  );

  return (
    <div className="size-full overflow-hidden" role="group" aria-label={ariaLabel}>
      <CodeMirror
        key={fileType}
        value={value}
        onChange={onChange}
        theme={theme === "dark" ? githubDark : githubLight}
        extensions={extensions}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
          highlightActiveLine: true,
          indentOnInput: true,
          tabSize: 2,
        }}
        height="100%"
        className="size-full text-left [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
      />
    </div>
  );
}
