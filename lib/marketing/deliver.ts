import "server-only";
import type { Campaign, CampaignChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { marketingEmail } from "@/lib/emails";
import { env } from "@/lib/env";
import { resolveAudience, type Recipient, type SegmentConfig } from "./audience";
import { CHANNEL_LIVE } from "./channels";

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

/** Push / WhatsApp / SMS — registered but not yet wired (future-ready, no-op). */
const stubAdapter: Adapter = async () => 0;

const ADAPTERS: Record<CampaignChannel, Adapter> = {
  IN_APP: inAppAdapter,
  EMAIL: emailAdapter,
  PUSH: stubAdapter,
  WHATSAPP: stubAdapter,
  SMS: stubAdapter,
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

/** Process all due scheduled campaigns — called by the Vercel Cron dispatch route. */
export async function dispatchDueCampaigns(now = new Date()): Promise<number> {
  const due = await prisma.campaign.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: now } },
    select: { id: true },
    take: 50,
  });
  let processed = 0;
  for (const d of due) {
    const res = await dispatchCampaign(d.id);
    if (res.ok) processed++;
  }
  return processed;
}
