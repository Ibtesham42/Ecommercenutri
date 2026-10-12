/**
 * PWA install state — ONE shared, client-side store (no React, no server deps).
 *
 * Installing is always user-initiated (Menu → Install App). This module:
 *  - captures `beforeinstallprompt` once, as soon as the client bundle loads,
 *    and always `preventDefault()`s it — that suppresses Chrome's automatic
 *    install mini-infobar and keeps the event for a later user click;
 *  - listens to `appinstalled` (the browser's own confirmation) once;
 *  - tracks whether we're running as the installed app (display-mode standalone).
 * Listeners are registered exactly once per page (module singleton); React
 * consumers subscribe/unsubscribe via `subscribePwaInstall` (useSyncExternalStore).
 */

export type InstallState = {
  /** A native install prompt is available right now (Chromium browsers). */
  canPrompt: boolean;
  /** The browser confirmed an install on this device (or we're running installed). */
  installed: boolean;
  /** Running as the installed app. */
  standalone: boolean;
};

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Set when the browser fires `appinstalled` (shared with the push-ask logic). */
export const K_INSTALLED = "nutriyet-pwa-installed";

const SERVER_STATE: InstallState = { canPrompt: false, installed: false, standalone: false };

let state: InstallState = SERVER_STATE;
let deferred: BeforeInstallPromptEvent | null = null;
let started = false;
const subscribers = new Set<() => void>();
const installedListeners = new Set<() => void>();

function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode / storage blocked */
  }
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function recompute(): void {
  const standalone = isStandalone();
  if (standalone) lsSet(K_INSTALLED, "1");
  state = { canPrompt: deferred !== null, installed: standalone || lsGet(K_INSTALLED) === "1", standalone };
  for (const fn of subscribers) fn();
}

/** Register the window listeners (idempotent; no-op on the server). */
export function startPwaInstallCapture(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // no automatic browser install UI — only Menu → Install App
    deferred = e as BeforeInstallPromptEvent; // may re-fire; keep the latest
    // The browser only offers this when the app is NOT installed, so any
    // earlier "installed" flag is stale (e.g. the app was uninstalled).
    lsSet(K_INSTALLED, null);
    recompute();
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    lsSet(K_INSTALLED, "1");
    recompute();
    for (const fn of installedListeners) fn();
  });

  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", recompute);
  window.addEventListener("storage", (e) => {
    if (e.key === K_INSTALLED) recompute();
  });

  recompute();
}

export function subscribePwaInstall(callback: () => void): () => void {
  startPwaInstallCapture();
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export const getPwaInstallState = (): InstallState => state;
export const getPwaInstallServerState = (): InstallState => SERVER_STATE;

/** Called once per browser-confirmed install (the `appinstalled` event). */
export function onAppInstalled(callback: () => void): () => void {
  startPwaInstallCapture();
  installedListeners.add(callback);
  return () => {
    installedListeners.delete(callback);
  };
}

/**
 * Show the browser's native install prompt (must be called from a user
 * gesture). "accepted" only means the user agreed — the install itself is
 * confirmed separately by `appinstalled`. A prompt event is single-use.
 */
export async function promptInstall(): Promise<InstallOutcome> {
  const evt = deferred;
  if (!evt) return "unavailable";
  deferred = null;
  recompute();
  try {
    await evt.prompt();
    const choice = await evt.userChoice;
    return choice.outcome === "accepted" ? "accepted" : "dismissed";
  } catch {
    return "unavailable";
  }
}

// ---------------------------------------------------------------------------
// Manual install instructions (pure — unit-tested)
// ---------------------------------------------------------------------------

export type InstallGuideKind = "ios" | "android" | "desktop-chromium" | "desktop-safari" | "desktop-firefox" | "other";

export type InstallGuide = { kind: InstallGuideKind; heading: string; steps: string[] };

/** How to install from this browser when no native prompt is available. */
export function installGuide(userAgent: string, maxTouchPoints = 0): InstallGuide {
  const ua = userAgent.toLowerCase();
  const ios = /iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && maxTouchPoints > 1); // iPadOS reports a Mac UA
  if (ios) {
    const safari = !/crios|fxios|edgios|opios/.test(ua);
    return {
      kind: "ios",
      heading: "On iPhone or iPad",
      steps: safari
        ? ["Tap the Share button in Safari.", "Scroll down and choose “Add to Home Screen”.", "Tap Add."]
        : [
            "Tap the Share button (in this browser it may be inside the menu).",
            "Choose “Add to Home Screen”. If you don’t see it, open nutriyet.in in Safari and use Share → Add to Home Screen.",
          ],
    };
  }
  if (/android/.test(ua)) {
    return {
      kind: "android",
      heading: "On Android",
      steps: [
        "Open your browser menu (⋮).",
        "Tap “Install app” or “Add to Home screen”.",
        "Confirm to add Nutriyet to your home screen.",
      ],
    };
  }
  if (/firefox|fxios/.test(ua)) {
    return {
      kind: "desktop-firefox",
      heading: "On this browser",
      steps: [
        "Firefox on desktop can’t install web apps.",
        "Open nutriyet.in in Chrome or Edge and choose Install from the address bar or browser menu.",
      ],
    };
  }
  if (/edg\/|chrome|chromium|opr\//.test(ua)) {
    return {
      kind: "desktop-chromium",
      heading: "On your computer",
      steps: [
        "Look for the install icon at the right end of the address bar and click it.",
        "Or open the browser menu (⋮ or …) and choose “Install Nutriyet” / “Apps → Install this site as an app”.",
      ],
    };
  }
  if (/safari/.test(ua) && /macintosh/.test(ua)) {
    return {
      kind: "desktop-safari",
      heading: "On your Mac",
      steps: ["In Safari, open the File menu (or Share).", "Choose “Add to Dock”."],
    };
  }
  return {
    kind: "other",
    heading: "On this browser",
    steps: [
      "Open your browser menu and look for “Install app” or “Add to Home screen”.",
      "If it isn’t there, this browser can’t install web apps — try Chrome, Edge or Safari.",
    ],
  };
}

// Capture the browser's install event as early as the client bundle loads.
if (typeof window !== "undefined") startPwaInstallCapture();
