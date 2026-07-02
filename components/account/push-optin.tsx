"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isPushSupported, subscribeToPush } from "@/lib/push-client";

type State = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed";

/** Web Push opt-in. Renders nothing unless VAPID is configured and the browser
 *  supports push. Subscribes the current user so marketing/automation campaigns can
 *  reach them on the Push channel. */
export function PushOptIn({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!vapidPublicKey || !isPushSupported()) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      if (!reg) {
        setState("unsubscribed");
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "subscribed" : "unsubscribed");
    });
  }, [vapidPublicKey]);

  async function enable() {
    setBusy(true);
    // Shared pipeline (lib/push-client); this component keeps its exact
    // previous states + toast copy.
    const result = await subscribeToPush(vapidPublicKey);
    if (result === "subscribed") {
      setState("subscribed");
      toast.success("Push notifications enabled 🔔");
    } else if (result === "denied") {
      setState("denied");
      toast.error("Notifications are blocked in your browser settings.");
    } else if (result === "dismissed") {
      setState("unsubscribed");
    } else {
      toast.error("Couldn't enable push notifications.");
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("unsubscribed");
      toast.success("Push notifications disabled");
    } catch (err) {
      console.error("[push] disable failed:", err);
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unsupported") return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Bell className="size-5" />
        </span>
        <div>
          <p className="font-medium">Push notifications</p>
          <p className="text-xs text-muted-foreground">
            {state === "denied"
              ? "Blocked — enable notifications for this site in your browser settings."
              : state === "subscribed"
                ? "You'll get order updates and offers on this device."
                : "Get order updates and exclusive offers on this device."}
          </p>
        </div>
      </div>
      {state === "subscribed" ? (
        <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={disable}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <BellOff className="size-4" />}
          Turn off
        </Button>
      ) : (
        <Button size="sm" className="gap-1.5" disabled={busy || state === "denied"} onClick={enable}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
          Enable
        </Button>
      )}
    </div>
  );
}
