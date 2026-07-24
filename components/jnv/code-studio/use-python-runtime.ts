"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Client-side Python execution via Pyodide (CPython compiled to WebAssembly),
 * loaded lazily from a CDN only when a student actually runs Python code —
 * never bundled into the app, never executed server-side. This is the only
 * safe way to offer "run arbitrary student Python" without ever eval-ing
 * untrusted code on the server.
 */

type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (text: string) => void }) => void;
  setStderr: (opts: { batched: (text: string) => void }) => void;
};

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

const PYODIDE_VERSION = "0.26.2";
const PYODIDE_CDN_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const SCRIPT_MARKER = "data-jnv-pyodide";

let pyodidePromise: Promise<PyodideInterface> | null = null;

function loadPyodideScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.loadPyodide) return Promise.resolve();

  const existing = document.querySelector(`script[${SCRIPT_MARKER}]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load the Python runtime.")));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${PYODIDE_CDN_BASE}pyodide.js`;
    script.setAttribute(SCRIPT_MARKER, "1");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load the Python runtime."));
    document.head.appendChild(script);
  });
}

async function getPyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = loadPyodideScript().then(() => {
      if (!window.loadPyodide) throw new Error("Python runtime failed to initialize.");
      return window.loadPyodide({ indexURL: PYODIDE_CDN_BASE });
    });
    // Don't cache a rejected load — let the next Run attempt retry from scratch.
    pyodidePromise.catch(() => {
      pyodidePromise = null;
    });
  }
  return pyodidePromise;
}

export type PythonRuntimeStatus = "idle" | "loading" | "ready" | "error";
export type PythonRunResult = { output: string; error: string | null };

export function usePythonRuntime() {
  const [status, setStatus] = useState<PythonRuntimeStatus>("idle");
  const pyodideRef = useRef<PyodideInterface | null>(null);

  const ensureReady = useCallback(async (): Promise<PyodideInterface> => {
    if (pyodideRef.current) return pyodideRef.current;
    setStatus("loading");
    try {
      const py = await getPyodide();
      pyodideRef.current = py;
      setStatus("ready");
      return py;
    } catch (err) {
      setStatus("error");
      throw err;
    }
  }, []);

  const run = useCallback(
    async (code: string): Promise<PythonRunResult> => {
      let py: PyodideInterface;
      try {
        py = await ensureReady();
      } catch {
        return {
          output: "",
          error: "Could not load the Python runtime. Check your internet connection and try again.",
        };
      }

      let output = "";
      py.setStdout({ batched: (text) => (output += text + "\n") });
      py.setStderr({ batched: (text) => (output += text + "\n") });

      try {
        await py.runPythonAsync(code);
        return { output, error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { output, error: message };
      }
    },
    [ensureReady],
  );

  return { status, run };
}
