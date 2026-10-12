"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Download, Share, SquarePlus, MoreVertical, MonitorDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trackClient } from "@/components/storefront/behavior-tracker";
import {
  getPwaInstallServerState,
  getPwaInstallState,
  installGuide,
  onAppInstalled,
  promptInstall,
  subscribePwaInstall,
  type InstallGuide,
} from "@/lib/pwa-install";

export type InstallCopy = { title: string; description: string };

type DialogMode = { kind: "guide"; guide: InstallGuide } | { kind: "installed" };

/**
 * Menu → Install App. Nothing here ever opens by itself:
 *  - native prompt available (Chromium) → the browser's own install prompt;
 *  - already installed (browser-confirmed) → a short "already installed" note;
 *  - otherwise → manual steps for this browser (iOS Safari, Android, desktop).
 * Mount once per page (the site header) and render `dialog` outside any sheet,
 * so closing the mobile drawer doesn't unmount it.
 */
export function useInstallApp(copy: InstallCopy) {
  const state = useSyncExternalStore(subscribePwaInstall, getPwaInstallState, getPwaInstallServerState);
  const [mode, setMode] = useState<DialogMode | null>(null);

  // The browser's own confirmation is the only time we say "installed".
  useEffect(
    () =>
      onAppInstalled(() => {
        setMode(null);
        toast.success("Nutriyet app installed", {
          description: "Open it any time from your home screen or app list.",
          duration: 6000,
        });
        trackClient({ type: "CLICK", source: "pwa-installed" });
      }),
    [],
  );

  async function start() {
    trackClient({ type: "CLICK", source: "pwa-install-click" });
    if (state.canPrompt) {
      const outcome = await promptInstall();
      if (outcome === "dismissed") {
        trackClient({ type: "CLICK", source: "pwa-install-dismissed" });
        return; // the user said no — no follow-up nag
      }
      if (outcome === "accepted") return; // `appinstalled` confirms + toasts
      // "unavailable": the prompt failed — fall through to manual steps.
    }
    if (getPwaInstallState().installed) {
      setMode({ kind: "installed" });
      return;
    }
    setMode({ kind: "guide", guide: installGuide(navigator.userAgent, navigator.maxTouchPoints ?? 0) });
    trackClient({ type: "CLICK", source: "pwa-install-guide-shown" });
  }

  const dialog = (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
      <DialogContent className="sm:max-w-md">
        {mode?.kind === "installed" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-primary" aria-hidden /> Nutriyet is already installed
              </DialogTitle>
              <DialogDescription>
                Open it from your home screen or app list. If you’ve removed it, your browser will offer to install
                it again from its menu.
              </DialogDescription>
            </DialogHeader>
          </>
        ) : mode?.kind === "guide" ? (
          <>
            <DialogHeader>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription>{copy.description}</DialogDescription>
            </DialogHeader>
            <div>
              <p className="text-sm font-medium text-foreground">{mode.guide.heading}</p>
              <ol className="mt-3 space-y-3 border-l border-border pl-4 text-sm leading-relaxed">
                {mode.guide.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <StepIcon kind={mode.guide.kind} index={i} />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setMode(null)} className="h-11 rounded-lg">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { state, start, dialog };
}

function StepIcon({ kind, index }: { kind: InstallGuide["kind"]; index: number }) {
  const cls = "mt-0.5 size-4 shrink-0 text-primary";
  if (kind === "ios") return index === 0 ? <Share className={cls} aria-hidden /> : <SquarePlus className={cls} aria-hidden />;
  if (kind === "android") return index === 0 ? <MoreVertical className={cls} aria-hidden /> : <Download className={cls} aria-hidden />;
  if (kind === "desktop-chromium") return <MonitorDown className={cls} aria-hidden />;
  return <Download className={cls} aria-hidden />;
}
