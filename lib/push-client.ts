"use client";

/**
 * Shared browser-side Web Push helpers — extracted from the account page's
 * PushOptIn so the PWA install prompt can reuse the exact same subscribe
 * pipeline (permission → SW registration → pushManager.subscribe → persist via
 * /api/push/subscribe). Toasts/UI stay in the callers.
 */

function urlB64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** True when this browser can do Web Push at all. */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export type PushSubscribeResult = "subscribed" | "denied" | "dismissed" | "error";

/**
 * Full subscribe pipeline. Requires a signed-in user (the subscribe API is
 * auth-gated) and a configured VAPID public key — callers gate on both.
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscribeResult> {
  try {
    const perm = await Notification.requestPermission();
    if (perm === "denied") return "denied";
    if (perm !== "granted") return "dismissed";
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(vapidPublicKey),
    });
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub),
    });
    return res.ok ? "subscribed" : "error";
  } catch (err) {
    console.error("[push] subscribe failed:", err);
    return "error";
  }
}
