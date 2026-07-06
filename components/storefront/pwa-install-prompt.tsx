"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Zap,
  WifiOff,
  Smartphone,
  Share,
  SquarePlus,
  Bell,
  Download,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackClient } from "@/components/storefront/behavior-tracker";
import { isPushSupported, subscribeToPush } from "@/lib/push-client";
import type { PwaSettings } from "@/lib/pwa-settings";

/**
 * PWA install experience:
 *  - Chrome/Edge (Android + desktop): native `beforeinstallprompt` flow.
 *  - iPhone/iPad Safari: Share → "Add to Home Screen" guide.
 *  - Notifications ask (strictly gated: signed-in + VAPID + supported +
 *    permission undecided + never asked before): offered right after a PWA
 *    install, on load when already installed, and — for regular browser tabs —
 *    after the visitor has settled in for a while (BROWSER_ASK_DELAY_MS).
 *    It never replaces a card that's already showing.
 * Display logic never annoys: once per session, reminder interval between
 * shows, permanently silent once installed / running standalone.
 */

/** Dwell time before politely offering notifications in a plain browser tab. */
const BROWSER_ASK_DELAY_MS = 45_000;

// --- storage (typeof-window guarded, quota-safe) -------------------------------

const K_INSTALLED = "nutriyet-pwa-installed";
const K_DISMISSED_AT = "nutriyet-pwa-dismissed-at";
const K_SESSION = "nutriyet-pwa-session";
const K_PUSH_ASKED = "nutriyet-push-asked";

function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}
function ssGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function ssSet(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIos =
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS ≥13 reports a Mac UA but has touch.
    (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  return isIos && !isStandalone();
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// --- presentational card (shared with the admin live preview) ------------------

export type PwaPromptMode = "native" | "ios" | "push";

export function PwaPromptCard({
  mode,
  title,
  description,
  installText,
  laterText,
  logoUrl,
  busy,
  onInstall,
  onLater,
  onClose,
}: {
  mode: PwaPromptMode;
  title: string;
  description: string;
  installText: string;
  laterText: string;
  logoUrl?: string | null;
  busy?: boolean;
  onInstall?: () => void;
  onLater?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-4 text-card-foreground shadow-elev-3">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-2.5 top-2.5 grid size-8 touch-manipulation place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-primary">
          {mode === "push" ? (
            <Bell className="size-5" />
          ) : logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-full object-contain p-1.5" />
          ) : (
            <Smartphone className="size-5" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-snug">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>

      {mode === "native" && (
        <>
          <ul className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[11px] text-muted-foreground">
            <li className="rounded-lg bg-accent/40 px-1 py-2">
              <Zap className="mx-auto mb-1 size-4 text-primary" /> Faster loading
            </li>
            <li className="rounded-lg bg-accent/40 px-1 py-2">
              <WifiOff className="mx-auto mb-1 size-4 text-primary" /> Works offline
            </li>
            <li className="rounded-lg bg-accent/40 px-1 py-2">
              <Sparkles className="mx-auto mb-1 size-4 text-primary" /> App experience
            </li>
          </ul>
          <div className="mt-3 flex gap-2">
            <Button
              className="h-11 flex-1 gap-1.5 rounded-xl font-semibold shadow-elev-1 motion-safe:active:scale-[0.98]"
              disabled={busy}
              onClick={onInstall}
            >
              <Download className="size-4" /> {installText}
            </Button>
            <Button
              variant="ghost"
              className="h-11 touch-manipulation rounded-xl text-muted-foreground"
              onClick={onLater}
            >
              {laterText}
            </Button>
          </div>
        </>
      )}

      {mode === "ios" && (
        <ol className="mt-3 space-y-2 text-sm">
          <li className="flex items-center gap-2.5 rounded-lg bg-accent/40 px-3 py-2.5">
            <Share className="size-4 shrink-0 text-primary" />
            <span>
              Tap the <span className="font-semibold">Share</span> button in Safari
            </span>
          </li>
          <li className="flex items-center gap-2.5 rounded-lg bg-accent/40 px-3 py-2.5">
            <SquarePlus className="size-4 shrink-0 text-primary" />
            <span>
              Choose <span className="font-semibold">Add to Home Screen</span>
            </span>
          </li>
        </ol>
      )}

      {mode === "push" && (
        <div className="mt-3 flex gap-2">
          <Button
            className="h-11 flex-1 gap-1.5 rounded-xl font-semibold shadow-elev-1 motion-safe:active:scale-[0.98]"
            disabled={busy}
            onClick={onInstall}
          >
            <Bell className="size-4" /> {installText}
          </Button>
          <Button
            variant="ghost"
            className="h-11 touch-manipulation rounded-xl text-muted-foreground"
            onClick={onLater}
          >
            {laterText}
          </Button>
        </div>
      )}
    </div>
  );
}

// --- orchestrator ---------------------------------------------------------------

export function PwaInstallPrompt({
  settings,
  vapidPublicKey,
  signedIn,
  logoUrl,
}: {
  settings: PwaSettings;
  vapidPublicKey: string;
  signedIn: boolean;
  logoUrl: string | null;
}) {
  const [visible, setVisible] = useState<PwaPromptMode | null>(null);
  const [busy, setBusy] = useState(false);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const track = (source: string) => trackClient({ type: "CLICK", source });

  /** Gates for the polite notifications ask (all must hold). */
  const canAskPush = useCallback((): boolean => {
    return (
      !!vapidPublicKey &&
      signedIn &&
      isPushSupported() &&
      Notification.permission === "default" &&
      !lsGet(K_PUSH_ASKED)
    );
  }, [vapidPublicKey, signedIn]);

  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const askPushSoon = useCallback(
    (delayMs: number) => {
      if (!canAskPush()) return;
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => {
        // Re-check at fire time, and never replace a card that's already open
        // (if the install card is up, we simply don't ask this visit — the
        // one-time flag is only set when the user actually sees and closes it).
        if (canAskPush()) setVisible((v) => v ?? "push");
      }, delayMs);
    },
    [canAskPush],
  );

  useEffect(() => {
    // Installed detection first — self-heal the flag when running standalone.
    const standalone = isStandalone();
    if (standalone) lsSet(K_INSTALLED, "1");
    const installed = standalone || !!lsGet(K_INSTALLED);

    // Always listen for installs (covers omnibox/menu installs too).
    const onInstalled = () => {
      lsSet(K_INSTALLED, "1");
      setVisible(null);
      toast.success("🎉 Nutriyet App installed successfully!", {
        description: "Thank you for installing Nutriyet. Enjoy faster shopping and a better experience.",
        duration: 6000,
      });
      track("pwa-installed");
      // Politely offer notifications once the celebration lands.
      askPushSoon(2500);
    };
    window.addEventListener("appinstalled", onInstalled);

    // Hide if another tab installs/dismisses.
    const onStorage = (e: StorageEvent) => {
      if (e.key === K_INSTALLED || e.key === K_DISMISSED_AT) setVisible(null);
    };
    window.addEventListener("storage", onStorage);

    // Installed (now or previously): the install card never shows, but the
    // signed-in-later notifications ask still may (once).
    if (installed) {
      askPushSoon(4000);
      return () => {
        window.removeEventListener("appinstalled", onInstalled);
        window.removeEventListener("storage", onStorage);
        if (pushTimer.current) clearTimeout(pushTimer.current);
      };
    }

    // Install-prompt eligibility.
    const eligible = (() => {
      if (!settings.enabled) return false;
      if (ssGet(K_SESSION)) return false;
      const dismissedAt = Number(lsGet(K_DISMISSED_AT) ?? 0);
      if (dismissedAt && Date.now() - dismissedAt < settings.remindDays * 86_400_000) return false;
      return true;
    })();

    const show = (mode: "native" | "ios") => {
      if (showTimer.current) return;
      showTimer.current = setTimeout(() => {
        // Never cover task-critical surfaces — an install nag must not block
        // the cart CTA, checkout or the auth flow.
        const path = window.location.pathname;
        if (["/checkout", "/cart", "/login", "/register"].some((p) => path.startsWith(p))) {
          return;
        }
        // Stamp the session at SHOW time (not only on dismiss) so ignoring the
        // card doesn't re-summon it on every subsequent page load — this is
        // what the "once per session" promise above actually means.
        ssSet(K_SESSION, "1");
        setVisible(mode);
        track(mode === "ios" ? "pwa-ios-guide-shown" : "pwa-prompt-shown");
      }, 4000);
    };

    const onBip = (e: Event) => {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent; // may re-fire; keep latest
      if (eligible) show("native");
    };
    window.addEventListener("beforeinstallprompt", onBip);

    if (eligible && isIosSafari()) show("ios");

    // Regular browser tab (not installed): politely offer notifications once
    // the visitor has settled in. Same strict gates — signed-in, supported,
    // permission undecided, never asked before — and it yields to any install
    // card already on screen.
    askPushSoon(BROWSER_ASK_DELAY_MS);

    return () => {
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beforeinstallprompt", onBip);
      if (showTimer.current) clearTimeout(showTimer.current);
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss(source: "pwa-maybe-later" | "pwa-dismissed") {
    ssSet(K_SESSION, "1");
    lsSet(K_DISMISSED_AT, String(Date.now()));
    setVisible(null);
    track(source);
  }

  async function install() {
    const evt = deferred.current;
    if (!evt) return;
    track("pwa-install-click");
    setBusy(true);
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === "dismissed") dismiss("pwa-maybe-later");
      else setVisible(null); // `appinstalled` handles the rest
    } catch {
      dismiss("pwa-dismissed");
    } finally {
      deferred.current = null; // a BIP event's prompt() is single-use
      setBusy(false);
    }
  }

  function closePushAsk() {
    lsSet(K_PUSH_ASKED, "1");
    setVisible(null);
  }

  async function enablePush() {
    lsSet(K_PUSH_ASKED, "1");
    setBusy(true);
    const result = await subscribeToPush(vapidPublicKey);
    setBusy(false);
    setVisible(null);
    if (result === "subscribed") {
      toast.success("🔔 Notifications enabled", {
        description: "You'll get order updates, exclusive offers and healthy picks.",
      });
    }
    // Every other outcome is a silent, respectful close.
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={visible === "push" ? "Enable notifications" : "Install app"}
      className={cn(
        "fixed inset-x-3 z-[60] animate-fade-up",
        // Clear the mobile bottom tab bar; float bottom-right on desktop.
        "bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.75rem)]",
        "md:inset-x-auto md:bottom-6 md:right-6 md:w-96",
      )}
    >
      {visible === "push" ? (
        <PwaPromptCard
          mode="push"
          title="Enable notifications?"
          description="Get order updates, exclusive offers, and healthy snack recommendations."
          installText="Enable notifications"
          laterText="Not now"
          busy={busy}
          onInstall={enablePush}
          onLater={closePushAsk}
          onClose={closePushAsk}
        />
      ) : (
        <PwaPromptCard
          mode={visible}
          title={settings.title}
          description={settings.description}
          installText={settings.installText}
          laterText={settings.laterText}
          logoUrl={logoUrl}
          busy={busy}
          onInstall={install}
          onLater={() => dismiss("pwa-maybe-later")}
          onClose={() => dismiss("pwa-dismissed")}
        />
      )}
    </div>
  );
}
