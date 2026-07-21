"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type PresentationCtx = {
  active: boolean;
  toggle: () => void;
  enterFullscreen: () => void;
  fullscreen: boolean;
};

const Ctx = createContext<PresentationCtx | null>(null);
const STORAGE_KEY = "jnv_presentation";

/**
 * Classroom Presentation Mode — a single client-side toggle, persisted per
 * device (no login on the student side). Applying `jnv-presentation` on
 * `<html>` lets plain CSS (`app/jnv/presentation.css`) hide chrome and scale
 * the whole module via root font-size, so components don't need per-element
 * presentation-mode branching.
 */
export function JnvPresentationProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY) === "1") setActive(true);
    const onFsChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("jnv-presentation", active);
  }, [active]);

  const toggle = useCallback(() => {
    setActive((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      if (!next && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      return next;
    });
  }, []);

  const enterFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, []);

  return <Ctx.Provider value={{ active, toggle, enterFullscreen, fullscreen }}>{children}</Ctx.Provider>;
}

export function useJnvPresentation(): PresentationCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useJnvPresentation must be used within JnvPresentationProvider");
  return ctx;
}
