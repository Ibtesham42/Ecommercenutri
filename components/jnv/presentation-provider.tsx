"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type PresentationCtx = {
  active: boolean;
  toggle: () => void;
  enterFullscreen: () => void;
  fullscreen: boolean;
  darkStage: boolean;
  toggleDarkStage: () => void;
  laserPointer: boolean;
  toggleLaserPointer: () => void;
};

const Ctx = createContext<PresentationCtx | null>(null);
const STORAGE_KEY = "jnv_presentation";
const DARK_STAGE_KEY = "jnv_dark_stage";

/** True while focus is in a text input — keyboard shortcuts should not fire then. */
export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
}

/**
 * Classroom Presentation Mode — a single client-side toggle, persisted per
 * device (no login on the student side). Applying `jnv-presentation` on
 * `<html>` lets plain CSS (`app/jnv/presentation.css`) hide chrome and scale
 * the whole module via root font-size, so components don't need per-element
 * presentation-mode branching. Also owns the global "Dark stage" toggle
 * (projector-friendly near-black theme) and the F/Esc keyboard shortcuts.
 */
export function JnvPresentationProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [darkStage, setDarkStage] = useState(false);
  const [laserPointer, setLaserPointer] = useState(false);
  const previousDarkRef = useRef(false);

  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY) === "1") setActive(true);
    if (window.localStorage.getItem(DARK_STAGE_KEY) === "1") {
      previousDarkRef.current = document.documentElement.classList.contains("dark");
      document.documentElement.classList.add("dark");
      setDarkStage(true);
    }
    const onFsChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("jnv-presentation", active);
    if (!active) setLaserPointer(false);
  }, [active]);

  const toggleLaserPointer = useCallback(() => setLaserPointer((v) => !v), []);

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

  // Doesn't touch next-themes' own storage/state — just the `.dark` class on
  // <html> (which is all Tailwind's `dark:` variant checks for), restored to
  // whatever it was before entering the stage so a teacher's presentation
  // choice never leaks into the site's actual light/dark preference.
  const toggleDarkStage = useCallback(() => {
    setDarkStage((prev) => {
      const next = !prev;
      window.localStorage.setItem(DARK_STAGE_KEY, next ? "1" : "0");
      if (next) {
        previousDarkRef.current = document.documentElement.classList.contains("dark");
        document.documentElement.classList.add("dark");
      } else if (!previousDarkRef.current) {
        document.documentElement.classList.remove("dark");
      }
      return next;
    });
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(document.activeElement)) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        enterFullscreen();
      } else if (e.key === "Escape" && active) {
        toggle();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, toggle, enterFullscreen]);

  return (
    <Ctx.Provider
      value={{
        active,
        toggle,
        enterFullscreen,
        fullscreen,
        darkStage,
        toggleDarkStage,
        laserPointer,
        toggleLaserPointer,
      }}
    >
      {children}
      {laserPointer && <LaserPointer />}
    </Ctx.Provider>
  );
}

/** Fixed red glow that follows the pointer — a classic "laser pointer" aid
 *  for pointing things out on a projected screen without a physical device. */
function LaserPointer() {
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const el = dotRef.current;
      if (!el) return;
      el.style.transform = `translate(${e.clientX - 9}px, ${e.clientY - 9}px)`;
    }
    document.addEventListener("pointermove", onMove);
    return () => document.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div
      ref={dotRef}
      className="pointer-events-none fixed left-0 top-0 z-[60] size-[18px] rounded-full bg-red-500 shadow-[0_0_12px_4px_rgba(239,68,68,0.7)]"
      aria-hidden="true"
    />
  );
}

export function useJnvPresentation(): PresentationCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useJnvPresentation must be used within JnvPresentationProvider");
  return ctx;
}
