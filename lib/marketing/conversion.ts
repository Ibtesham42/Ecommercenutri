import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Credit a marketing campaign for an order when the buyer arrived via a tracked
 * campaign click (the `nut_campaign` cookie). Best-effort — never throws, and the
 * cookie is cleared so each order is counted once. Call from `createOrder`.
 */
export async function recordCampaignConversion(
  userId: string | null,
  orderTotal: number,
): Promise<void> {
  try {
    const store = await cookies();
    const campaignId = store.get("nut_campaign")?.value;
    if (!campaignId) return;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true },
    });
    if (campaign) {
      await prisma.$transaction([
        prisma.campaignEvent.create({
          data: { campaignId, userId, type: "CONVERSION", meta: { revenue: orderTotal } },
        }),
        prisma.campaign.update({
          where: { id: campaignId },
          data: { conversionCount: { increment: 1 }, revenue: { increment: orderTotal } },
        }),
      ]);
    }
    store.delete("nut_campaign");
  } catch (err) {
    console.error("[marketing] conversion record failed:", err);
  }
}
