"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { getBusinessIntelligence, NOT_CANCELLED } from "@/lib/queries/bi";
import { answerBusinessQuestion } from "@/lib/ai/insights";
import { formatPrice } from "@/lib/format";

export type AskResult = { ok: true; text: string; ai: boolean } | { ok: false; error: string };

export type LiveSnapshot =
  | {
      ok: true;
      liveVisitors: number;
      ordersToday: number;
      revenueTodayLabel: string;
      latestCartAdds: { name: string; agoLabel: string }[];
      latestOrders: { label: string; agoLabel: string }[];
      at: string;
    }
  | { ok: false; error: string };

function agoLabel(d: Date): string {
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

/** Real-time strip data for /admin/insights — polled by the client, never cached. */
export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  try {
    await requirePermission("ai");
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60_000);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const [recentEvents, cartEvents, orders, todayAgg] = await Promise.all([
      prisma.userEvent.findMany({
        where: { createdAt: { gte: fiveMinAgo } },
        select: { userId: true, anonId: true },
        take: 2_000,
      }),
      prisma.userEvent.findMany({
        where: { type: "CART_ADD", createdAt: { gte: todayStart }, productId: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { productId: true, createdAt: true },
        take: 5,
      }),
      prisma.order.findMany({
        where: { status: NOT_CANCELLED, createdAt: { gte: todayStart } },
        orderBy: { createdAt: "desc" },
        select: { orderNumber: true, total: true, createdAt: true },
        take: 5,
      }),
      prisma.order.aggregate({
        where: { status: NOT_CANCELLED, createdAt: { gte: todayStart } },
        _sum: { total: true },
        _count: { _all: true },
      }),
    ]);

    const live = new Set<string>();
    for (const e of recentEvents) {
      const id = e.userId ?? e.anonId;
      if (id) live.add(id);
    }

    const productIds = [...new Set(cartEvents.map((e) => e.productId).filter((x): x is string => !!x))];
    const products = productIds.length
      ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(products.map((p) => [p.id, p.name]));

    return {
      ok: true,
      liveVisitors: live.size,
      ordersToday: todayAgg._count._all,
      revenueTodayLabel: formatPrice(todayAgg._sum.total ?? 0),
      latestCartAdds: cartEvents.map((e) => ({
        name: nameById.get(e.productId!) ?? "Product",
        agoLabel: agoLabel(e.createdAt),
      })),
      latestOrders: orders.map((o) => ({
        label: `${o.orderNumber} · ${formatPrice(o.total)}`,
        agoLabel: agoLabel(o.createdAt),
      })),
      at: now.toISOString(),
    };
  } catch (err) {
    console.error("[admin/insights] live snapshot failed:", err);
    return { ok: false, error: "Live data unavailable." };
  }
}

export type ReplayDetailResult =
  | { ok: true; replay: import("@/lib/queries/engagement").ReplayDetail }
  | { ok: false; error: string };

/** Full recording (pages + samples) for the session-replay player dialog. */
export async function getReplayDetail(id: unknown): Promise<ReplayDetailResult> {
  try {
    await requirePermission("ai");
    if (typeof id !== "string" || !/^[a-f0-9-]{16,40}$/i.test(id)) {
      return { ok: false, error: "Invalid recording." };
    }
    const { getSessionReplay } = await import("@/lib/queries/engagement");
    const replay = await getSessionReplay(id);
    return replay ? { ok: true, replay } : { ok: false, error: "Recording not found (it may have expired)." };
  } catch (err) {
    console.error("[admin/insights] replay detail failed:", err);
    return { ok: false, error: "Couldn't load the recording." };
  }
}

/** Answer an admin business question, grounded in the current BI snapshot. */
export async function askBusinessQuestion(question: unknown): Promise<AskResult> {
  await requirePermission("ai");
  if (typeof question !== "string" || question.trim().length < 2) {
    return { ok: false, error: "Type a question first." };
  }
  if (question.length > 300) return { ok: false, error: "Question is too long." };
  try {
    const bi = await getBusinessIntelligence();
    const ans = await answerBusinessQuestion(question, bi);
    return { ok: true, text: ans.text, ai: ans.ai };
  } catch (err) {
    console.error("[admin/insights] ask failed:", err);
    return { ok: false, error: "Couldn't analyze that right now." };
  }
}
