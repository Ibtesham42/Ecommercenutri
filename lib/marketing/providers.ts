import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { env, isConfigured } from "@/lib/env";

/**
 * Marketing channel providers. Each is **env-gated**: it sends for real when its
 * credentials are configured, and otherwise no-ops (returning false) — same keyless
 * philosophy as the rest of Nutriyet. Drop a real account's keys in and the channel
 * goes live with no code change. Called by the campaign + automation delivery paths.
 */

export type ChannelMessage = {
  title: string;
  body: string;
  imageUrl?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
};

export type SendTarget = {
  userId: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
};

let vapidReady = false;
function ensureVapid(): boolean {
  if (!isConfigured.webPush()) return false;
  if (!vapidReady) {
    webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
    vapidReady = true;
  }
  return true;
}

/** Web Push to all of a user's registered subscriptions. Prunes dead endpoints. */
export async function sendPush(target: SendTarget, msg: ChannelMessage): Promise<boolean> {
  if (!ensureVapid()) return false;
  const subs = await prisma.pushSubscription.findMany({ where: { userId: target.userId } });
  if (subs.length === 0) return false;

  const payload = JSON.stringify({
    title: msg.title,
    body: msg.body,
    icon: msg.imageUrl ?? "/brand-icon",
    url: msg.ctaUrl ?? "/",
  });

  let delivered = false;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      delivered = true;
    } catch (err: unknown) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        // Subscription expired/gone — clean it up.
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      } else {
        console.error("[marketing] push send failed:", err);
      }
    }
  }
  return delivered;
}

function buildText(msg: ChannelMessage): string {
  const parts = [msg.title, msg.body];
  if (msg.ctaUrl) parts.push(msg.ctaUrl);
  return parts.filter(Boolean).join("\n\n");
}

/** WhatsApp Cloud API (Meta). Note: production marketing sends outside the 24h
 *  service window require approved message templates; this sends a text body. */
export async function sendWhatsApp(target: SendTarget, msg: ChannelMessage): Promise<boolean> {
  if (!isConfigured.whatsapp() || !target.phone) return false;
  const to = target.phone.replace(/[^\d]/g, "");
  if (!to) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${env.whatsappPhoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsappToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: buildText(msg) },
      }),
    });
    if (!res.ok) {
      console.error("[marketing] whatsapp send failed:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[marketing] whatsapp send error:", err);
    return false;
  }
}

/** SMS via Twilio. */
export async function sendSMS(target: SendTarget, msg: ChannelMessage): Promise<boolean> {
  if (!isConfigured.sms() || !target.phone) return false;
  try {
    const body = new URLSearchParams({
      To: target.phone,
      From: env.twilioFrom,
      Body: `${msg.title}\n${msg.body}${msg.ctaUrl ? `\n${msg.ctaUrl}` : ""}`.slice(0, 1500),
    });
    const auth = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
    );
    if (!res.ok) {
      console.error("[marketing] sms send failed:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[marketing] sms send error:", err);
    return false;
  }
}
