import "server-only";
import type { AutomationRule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { marketingEmail } from "@/lib/emails";
import { CHANNEL_LIVE } from "./channels";
import { sendPush, sendWhatsApp, sendSMS, type ChannelMessage } from "./providers";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const PER_RUN_CAP = 500; // safety cap per rule per run

type Candidate = {
  userId: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  key: string;
};

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  addresses: { orderBy: { updatedAt: "desc" }, take: 1, select: { phone: true } },
} as const;

type UserPick = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  addresses: { phone: string }[];
};

function toCandidate(u: UserPick, key: string): Candidate {
  return { userId: u.id, email: u.email, name: u.name, phone: u.phone ?? u.addresses[0]?.phone ?? null, key };
}

/** New accounts older than the delay (bounded so enabling doesn't blast old users). */
async function welcomeCandidates(delayHours: number): Promise<Candidate[]> {
  const now = Date.now();
  const cutoff = new Date(now - delayHours * HOUR_MS);
  const floor = new Date(now - delayHours * HOUR_MS - 14 * DAY_MS);
  const users = await prisma.user.findMany({
    where: { role: "USER", isActive: true, createdAt: { lte: cutoff, gte: floor } },
    select: USER_SELECT,
    take: 2000,
  });
  return users.map((u) => toCandidate(u, u.id));
}

/** Past customers with no order in the delay window. */
async function winbackCandidates(delayHours: number): Promise<Candidate[]> {
  const cutoff = new Date(Date.now() - delayHours * HOUR_MS);
  const users = await prisma.user.findMany({
    where: {
      role: "USER",
      isActive: true,
      orders: { some: {}, none: { createdAt: { gte: cutoff } } },
    },
    select: USER_SELECT,
    take: 2000,
  });
  return users.map((u) => toCandidate(u, u.id));
}

/** Carts sitting with items past the delay, with no order placed since. */
async function abandonedCartCandidates(delayHours: number): Promise<Candidate[]> {
  const cutoff = new Date(Date.now() - delayHours * HOUR_MS);
  const floor = new Date(Date.now() - delayHours * HOUR_MS - 30 * DAY_MS);
  const carts = await prisma.cart.findMany({
    where: {
      updatedAt: { lte: cutoff, gte: floor },
      items: { some: {} },
      user: { isActive: true, role: "USER" },
    },
    select: {
      userId: true,
      updatedAt: true,
      user: {
        select: {
          email: true,
          name: true,
          phone: true,
          addresses: { orderBy: { updatedAt: "desc" }, take: 1, select: { phone: true } },
        },
      },
    },
    take: 2000,
  });
  const out: Candidate[] = [];
  for (const c of carts) {
    const ordered = await prisma.order.count({
      where: { userId: c.userId, createdAt: { gte: c.updatedAt } },
    });
    if (ordered === 0) {
      out.push({
        userId: c.userId,
        email: c.user.email,
        name: c.user.name,
        phone: c.user.phone ?? c.user.addresses[0]?.phone ?? null,
        key: c.userId,
      });
    }
  }
  return out;
}

/** Orders delivered at least `delayHours` ago — keyed per order (not per user). */
async function postPurchaseCandidates(delayHours: number): Promise<Candidate[]> {
  const cutoff = new Date(Date.now() - delayHours * HOUR_MS);
  const floor = new Date(Date.now() - delayHours * HOUR_MS - 30 * DAY_MS);
  const events = await prisma.orderEvent.findMany({
    where: { status: "DELIVERED", createdAt: { lte: cutoff, gte: floor } },
    select: {
      orderId: true,
      order: {
        select: {
          userId: true,
          user: {
            select: {
              email: true,
              name: true,
              phone: true,
              addresses: { orderBy: { updatedAt: "desc" }, take: 1, select: { phone: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  return events.map((e) => ({
    userId: e.order.userId,
    email: e.order.user.email,
    name: e.order.user.name,
    phone: e.order.user.phone ?? e.order.user.addresses[0]?.phone ?? null,
    key: e.orderId,
  }));
}

async function candidatesFor(rule: AutomationRule): Promise<Candidate[]> {
  switch (rule.trigger) {
    case "WELCOME":
      return welcomeCandidates(rule.delayHours);
    case "WINBACK":
      return winbackCandidates(rule.delayHours);
    case "ABANDONED_CART":
      return abandonedCartCandidates(rule.delayHours);
    case "POST_PURCHASE":
      return postPurchaseCandidates(rule.delayHours);
    default:
      return [];
  }
}

async function deliver(rule: AutomationRule, c: Candidate): Promise<void> {
  const msg: ChannelMessage = {
    title: rule.title,
    body: rule.body,
    imageUrl: rule.imageUrl,
    ctaText: rule.ctaText,
    ctaUrl: rule.ctaUrl,
  };
  const has = (ch: (typeof rule.channels)[number]) => rule.channels.includes(ch) && CHANNEL_LIVE[ch];

  if (has("IN_APP")) {
    await notify(c.userId, { type: "GENERAL", title: rule.title, body: rule.body, link: rule.ctaUrl ?? null });
  }
  if (has("EMAIL") && c.email) {
    try {
      await sendEmail({ to: c.email, ...marketingEmail({ ...msg, name: c.name }) });
    } catch (e) {
      console.error("[marketing] automation email failed:", e);
    }
  }
  if (has("PUSH")) await sendPush(c, msg);
  if (has("WHATSAPP")) await sendWhatsApp(c, msg);
  if (has("SMS")) await sendSMS(c, msg);
}

/**
 * Evaluate every enabled automation rule and deliver to newly-eligible recipients.
 * Dedup is enforced by `AutomationLog` (`@@unique([ruleId, key])`), so each user
 * (or order, for post-purchase) receives a rule at most once. Called by the cron
 * dispatch route alongside scheduled campaigns. Returns total messages delivered.
 */
export async function runAutomations(): Promise<number> {
  const rules = await prisma.automationRule.findMany({ where: { enabled: true } });
  let total = 0;

  for (const rule of rules) {
    try {
      const candidates = await candidatesFor(rule);
      if (candidates.length === 0) continue;

      const already = await prisma.automationLog.findMany({
        where: { ruleId: rule.id, key: { in: candidates.map((c) => c.key) } },
        select: { key: true },
      });
      const sentKeys = new Set(already.map((a) => a.key));
      const fresh = candidates.filter((c) => !sentKeys.has(c.key)).slice(0, PER_RUN_CAP);
      if (fresh.length === 0) continue;

      let delivered = 0;
      for (const c of fresh) {
        try {
          // Reserve the dedup row first; a unique clash means another run took it.
          await prisma.automationLog.create({ data: { ruleId: rule.id, userId: c.userId, key: c.key } });
        } catch {
          continue;
        }
        await deliver(rule, c);
        delivered++;
      }

      if (delivered > 0) {
        await prisma.automationRule.update({
          where: { id: rule.id },
          data: { sentCount: { increment: delivered }, lastRunAt: new Date() },
        });
      }
      total += delivered;
    } catch (err) {
      console.error("[marketing] automation rule failed:", rule.id, err);
    }
  }

  return total;
}
