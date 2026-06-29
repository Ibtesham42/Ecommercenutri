import "server-only";
import { Prisma } from "@prisma/client";
import type { Campaign, CampaignChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { marketingEmail } from "@/lib/emails";
import { env } from "@/lib/env";
import { resolveAudience, type Recipient, type SegmentConfig } from "./audience";
import { CHANNEL_LIVE } from "./channels";
import { sendPush, sendWhatsApp, sendSMS, type ChannelMessage } from "./providers";

function trackingUrls(campaignId: string, userId: string, ctaUrl: string | null) {
  const base = env.appUrl.replace(/\/$/, "");
  const open = `${base}/api/marketing/open/${campaignId}?u=${userId}`;
  const click = ctaUrl
    ? `${base}/api/marketing/click/${campaignId}?u=${userId}&to=${encodeURIComponent(ctaUrl)}`
    : null;
  return { open, click };
}

/** A channel adapter sends a campaign to recipients and returns the delivered count. */
type Adapter = (c: Campaign, recipients: Recipient[]) => Promise<number>;

const inAppAdapter: Adapter = async (c, recipients) => {
  let delivered = 0;
  for (const r of recipients) {
    const { click } = trackingUrls(c.id, r.userId, c.ctaUrl);
    await notify(r.userId, {
      type: "GENERAL",
      title: c.title,
      body: c.body,
      link: click ?? c.ctaUrl ?? null,
    });
    delivered++;
  }
  return delivered;
};

const emailAdapter: Adapter = async (c, recipients) => {
  let delivered = 0;
  for (const r of recipients) {
    if (!r.email) continue;
    const { open, click } = trackingUrls(c.id, r.userId, c.ctaUrl);
    try {
      await sendEmail({
        to: r.email,
        ...marketingEmail({
          title: c.title,
          body: c.body,
          imageUrl: c.imageUrl,
          ctaText: c.ctaText,
          ctaUrl: click ?? c.ctaUrl,
          openUrl: open,
          name: r.name,
        }),
      });
      delivered++;
    } catch (e) {
      console.error("[marketing] email send failed:", e);
    }
  }
  return delivered;
};

function campaignMessage(c: Campaign): ChannelMessage {
  return { title: c.title, body: c.body, imageUrl: c.imageUrl, ctaText: c.ctaText, ctaUrl: c.ctaUrl };
}

/** Provider-backed adapter (Push/WhatsApp/SMS). Env-gated — no-ops when unconfigured. */
function providerAdapter(
  send: (t: Recipient, m: ChannelMessage) => Promise<boolean>,
): Adapter {
  return async (c, recipients) => {
    let delivered = 0;
    const msg = campaignMessage(c);
    for (const r of recipients) {
      if (await send(r, msg)) delivered++;
    }
    return delivered;
  };
}

const ADAPTERS: Record<CampaignChannel, Adapter> = {
  IN_APP: inAppAdapter,
  EMAIL: emailAdapter,
  PUSH: providerAdapter(sendPush),
  WHATSAPP: providerAdapter(sendWhatsApp),
  SMS: providerAdapter(sendSMS),
};

/**
 * Send a campaign now: resolve the audience, deliver across each live channel,
 * record aggregate stats and mark it SENT (or FAILED). Idempotent guard against
 * double-send. Open/click/conversion metrics accrue afterwards via the tracking
 * routes (`/api/marketing/open|click`).
 */
export async function dispatchCampaign(
  campaignId: string,
): Promise<{ ok: boolean; sent: number; error?: string }> {
  const c = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!c) return { ok: false, sent: 0, error: "Campaign not found." };
  if (c.status === "SENT" || c.status === "SENDING") {
    return { ok: false, sent: 0, error: "This campaign was already sent." };
  }

  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "SENDING" } });

  try {
    const recipients = await resolveAudience(c.segmentType, (c.segmentConfig as SegmentConfig) ?? {});
    let sentCount = 0;
    let delivered = 0;
    for (const channel of c.channels) {
      if (!CHANNEL_LIVE[channel]) continue;
      sentCount += recipients.length;
      delivered += await ADAPTERS[channel](c, recipients);
    }
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        audienceSize: recipients.length,
        sentCount,
        deliveredCount: delivered,
      },
    });
    return { ok: true, sent: delivered };
  } catch (err) {
    console.error("[marketing] dispatch failed:", err);
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "FAILED" } });
    return { ok: false, sent: 0, error: "Dispatch failed." };
  }
}

const RECURRING = new Set(["DAILY", "WEEKLY", "MONTHLY"]);

/** Next occurrence strictly after `now`, advancing from `from` by the cadence
 *  (skips any missed windows so a slow cron doesn't fire a backlog). */
export function nextRun(recurrence: string, from: Date, now = new Date()): Date {
  const next = new Date(from);
  const step = () => {
    if (recurrence === "DAILY") next.setDate(next.getDate() + 1);
    else if (recurrence === "WEEKLY") next.setDate(next.getDate() + 7);
    else if (recurrence === "MONTHLY") next.setMonth(next.getMonth() + 1);
  };
  do {
    step();
  } while (next <= now);
  return next;
}

/**
 * Process all due scheduled campaigns. A one-off campaign is dispatched in place
 * (→ SENT). A **recurring** campaign acts as a series: each due fire spawns a
 * one-off child snapshot (dispatched for its own per-occurrence analytics) and the
 * parent is re-armed to its next occurrence. Called by the Vercel Cron route.
 */
export async function dispatchDueCampaigns(now = new Date()): Promise<number> {
  const due = await prisma.campaign.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: now } },
    take: 50,
  });
  let processed = 0;

  for (const c of due) {
    const recurrence = c.recurrence ?? "NONE";
    if (!RECURRING.has(recurrence)) {
      const res = await dispatchCampaign(c.id);
      if (res.ok) processed++;
      continue;
    }

    // Recurring series: send a child occurrence, then advance the parent.
    try {
      const stamp = (c.scheduledFor ?? now).toISOString().slice(0, 16).replace("T", " ");
      const child = await prisma.campaign.create({
        data: {
          name: `${c.name} · ${stamp}`,
          type: c.type,
          status: "DRAFT",
          channels: c.channels,
          title: c.title,
          body: c.body,
          imageUrl: c.imageUrl,
          ctaText: c.ctaText,
          ctaUrl: c.ctaUrl,
          segmentType: c.segmentType,
          segmentConfig: (c.segmentConfig as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          productId: c.productId,
          couponId: c.couponId,
          recurrence: null,
        },
      });
      const res = await dispatchCampaign(child.id);
      if (res.ok) processed++;
      await prisma.campaign.update({
        where: { id: c.id },
        data: { scheduledFor: nextRun(recurrence, c.scheduledFor ?? now, now), sentAt: new Date() },
      });
    } catch (err) {
      console.error("[marketing] recurring dispatch failed:", c.id, err);
    }
  }

  return processed;
}
