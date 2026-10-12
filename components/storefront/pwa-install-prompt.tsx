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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isPushSupported, subscribeToPush } from "@/lib/push-client";
import { getPwaInstallState, onAppInstalled } from "@/lib/pwa-install";

/**
 * Shared PWA prompt card (notifications ask + the admin preview) and the
 * signed-in notifications ask. The app is installed only on request, via
 * Menu → Install App (components/storefront/install-app.tsx + lib/pwa-install.ts)
 * — nothing in this file ever offers an install by itself.
 */

/** Dwell time before politely offering notifications in a plain browser tab. */
const BROWSER_ASK_DELAY_MS = 45_000;

// --- storage (typeof-window guarded, quota-safe) -------------------------------

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

/** True while any Radix dialog (welcome popup, coupon reveal, …) is open —
 *  the notifications card must never stack on top of a modal moment. */
function modalIsOpen(): boolean {
  return !!document.querySelector('[role="dialog"][data-state="open"]');
}

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
        {mode === "push" ? (
          <Bell className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} />
        ) : logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="mt-0.5 size-8 shrink-0 object-contain" />
        ) : (
          <Smartphone className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} />
        )}
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-snug">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>

      {mode === "native" && (
        <>
          <ul className="mt-3 grid grid-cols-3 divide-x divide-border text-center text-[11px] text-muted-foreground">
            <li className="px-1 py-2">
              <Zap className="mx-auto mb-1 size-4 text-primary" strokeWidth={1.75} /> Faster loading
            </li>
            <li className="px-1 py-2">
              <WifiOff className="mx-auto mb-1 size-4 text-primary" strokeWidth={1.75} /> Works offline
            </li>
            <li className="px-1 py-2">
              <Smartphone className="mx-auto mb-1 size-4 text-primary" strokeWidth={1.75} /> App experience
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
        <ol className="mt-3 space-y-2.5 border-l border-border pl-3.5 text-sm">
          <li className="flex items-center gap-2.5">
            <Share className="size-4 shrink-0 text-primary" strokeWidth={1.75} />
            <span>
              Tap the <span className="font-semibold">Share</span> button in Safari
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <SquarePlus className="size-4 shrink-0 text-primary" strokeWidth={1.75} />
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

/**
 * Notifications ask only. Installing the app is user-initiated (Menu → Install
 * App, components/storefront/install-app.tsx) — this never shows an install
 * card. The ask follows a browser-confirmed install, appears on load when
 * already installed, or after a while in a regular tab; strictly gated (see
 * canAskPush) and it never stacks on an open modal.
 */
export function PwaInstallPrompt({
  vapidPublicKey,
  signedIn,
}: {
  vapidPublicKey: string;
  signedIn: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

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
        // Re-check at fire time, and yield to an open modal: skipping this
        // visit beats stacking a second overlay.
        if (canAskPush() && !modalIsOpen()) setVisible(true);
      }, delayMs);
    },
    [canAskPush],
  );

  useEffect(() => {
    // After a browser-confirmed install, politely offer notifications.
    const off = onAppInstalled(() => askPushSoon(2500));
    askPushSoon(getPwaInstallState().installed ? 4000 : BROWSER_ASK_DELAY_MS);
    return () => {
      off();
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [askPushSoon]);

  function closePushAsk() {
    lsSet(K_PUSH_ASKED, "1");
    setVisible(false);
  }

  async function enablePush() {
    lsSet(K_PUSH_ASKED, "1");
    setBusy(true);
    const result = await subscribeToPush(vapidPublicKey);
    setBusy(false);
    setVisible(false);
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
      aria-label="Enable notifications"
      className={cn(
        // Below the dialog overlay (z-50): if a modal opens while the card is
        // up, the scrim covers it instead of the card floating on top.
        "fixed inset-x-3 z-40 animate-fade-up",
        // Clear the mobile bottom tab bar; float bottom-right on desktop.
        "bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.75rem)]",
        "md:inset-x-auto md:bottom-6 md:right-6 md:w-96",
      )}
    >
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
    </div>
  );
}
