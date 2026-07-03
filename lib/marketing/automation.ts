import "server-only";
import type { AutomationRule, CampaignChannel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { marketingEmail } from "@/lib/emails";
import { isConfigured } from "@/lib/env";
import { CHANNEL_LABEL } from "./channels";
import { sendPush, sendWhatsApp, sendSMS, type ChannelMessage } from "./providers";
import type {
  AutomationRunReport,
  ChannelOutcome,
  RuleRunReport,
} from "./automation-types";

export type { AutomationRunReport, ChannelOutcome, RuleRunReport };

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

/** Latest address phone for a user — test sends target the admin, who has no Recipient row. */
export async function latestPhone(userId: string): Promise<string | null> {
  const address = await prisma.address.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { phone: true },
  });
  return address?.phone ?? null;
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

/**
 * Abandoned carts. The storefront cart is client-side (Zustand/localStorage), so
 * the DB `Cart` table is empty in practice — the *real* signal is the `UserEvent`
 * CART_ADD log recorded by the behavior tracker. A signed-in user qualifies when
 * their **latest** cart-add is older than the delay (they went quiet) and they've
 * placed no order since. The legacy DB-cart query is kept as a union so a future
 * server-synced cart slots in unchanged.
 */
async function abandonedCartCandidates(delayHours: number): Promise<Candidate[]> {
  const now = Date.now();
  const cutoff = new Date(now - delayHours * HOUR_MS);
  const floor = new Date(now - delayHours * HOUR_MS - 30 * DAY_MS);
  const byUser = new Map<string, Candidate>();

  // Signal 1 — behavior events (the live source today). Latest CART_ADD per user.
  const events = await prisma.userEvent.findMany({
    where: { type: "CART_ADD", userId: { not: null }, createdAt: { gte: floor } },
    select: { userId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const lastAdd = new Map<string, Date>();
  for (const e of events) {
    if (e.userId && !lastAdd.has(e.userId)) lastAdd.set(e.userId, e.createdAt); // desc → first is latest
  }
  const eventUserIds = [...lastAdd.entries()]
    .filter(([, at]) => at <= cutoff)
    .map(([userId]) => userId);

  if (eventUserIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: eventUserIds }, role: "USER", isActive: true },
      select: USER_SELECT,
    });
    // One query for all orders since the window floor, compared per-user in JS.
    const orders = await prisma.order.findMany({
      where: { userId: { in: users.map((u) => u.id) }, createdAt: { gte: floor } },
      select: { userId: true, createdAt: true },
    });
    const lastOrder = new Map<string, Date>();
    for (const o of orders) {
      const prev = lastOrder.get(o.userId);
      if (!prev || o.createdAt > prev) lastOrder.set(o.userId, o.createdAt);
    }
    for (const u of users) {
      const addedAt = lastAdd.get(u.id);
      const orderedAt = lastOrder.get(u.id);
      if (addedAt && (!orderedAt || orderedAt < addedAt)) byUser.set(u.id, toCandidate(u, u.id));
    }
  }

  // Signal 2 — server-synced DB carts (future-proof; empty today).
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
  for (const c of carts) {
    if (byUser.has(c.userId)) continue;
    const ordered = await prisma.order.count({
      where: { userId: c.userId, createdAt: { gte: c.updatedAt } },
    });
    if (ordered === 0) {
      byUser.set(c.userId, {
        userId: c.userId,
        email: c.user.email,
        name: c.user.name,
        phone: c.user.phone ?? c.user.addresses[0]?.phone ?? null,
        key: c.userId,
      });
    }
  }

  return [...byUser.values()];
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

/** Human explanation for a rule that found zero eligible recipients. */
function emptyReason(rule: AutomationRule): string {
  switch (rule.trigger) {
    case "WELCOME":
      return "No accounts created in the eligibility window (delay to delay+14 days ago).";
    case "ABANDONED_CART":
      return "No signed-in customer has cart activity older than the delay without a later order.";
    case "WINBACK":
      return "No past customer has been inactive longer than the delay.";
    case "POST_PURCHASE":
      return "No order was delivered in the eligibility window (delay to delay+30 days ago).";
    default:
      return "No eligible recipients.";
  }
}

/** The content + channels a one-recipient delivery needs. `AutomationRule` and the
 *  campaign test-send payload both satisfy it structurally. */
export type MessageSpec = {
  channels: CampaignChannel[];
  title: string;
  body: string;
  imageUrl: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
};

export type OneRecipient = {
  userId: string;
  email: string | null;
  name: string | null;
  phone: string | null;
};

/**
 * Deliver a message to one recipient across its channels, returning the
 * truthful per-channel outcome. Unconfigured providers and the keyless email stub
 * are reported as SKIPPED/STUBBED — never as a successful delivery. Used by
 * automations (rules satisfy `MessageSpec`) and the admin campaign test-send.
 */
export async function deliverToOne(spec: MessageSpec, c: OneRecipient): Promise<ChannelOutcome[]> {
  const msg: ChannelMessage = {
    title: spec.title,
    body: spec.body,
    imageUrl: spec.imageUrl,
    ctaText: spec.ctaText,
    ctaUrl: spec.ctaUrl,
  };
  const outcomes: ChannelOutcome[] = [];

  for (const channel of spec.channels) {
    switch (channel) {
      case "IN_APP": {
        const ok = await notify(c.userId, {
          type: "GENERAL",
          title: spec.title,
          body: spec.body,
          link: spec.ctaUrl ?? null,
        });
        outcomes.push(
          ok
            ? { channel, status: "SENT" }
            : { channel, status: "FAILED", reason: "Could not create the in-app notification." },
        );
        break;
      }
      case "EMAIL": {
        if (!c.email) {
          outcomes.push({ channel, status: "SKIPPED", reason: "Recipient has no email address." });
          break;
        }
        try {
          const res = await sendEmail({ to: c.email, ...marketingEmail({ ...msg, name: c.name }) });
          outcomes.push(
            res.stubbed
              ? {
                  channel,
                  status: "STUBBED",
                  reason: "No email provider configured (SMTP/Resend) — logged to the server console only.",
                }
              : { channel, status: "SENT" },
          );
        } catch (e) {
          console.error("[marketing] automation email failed:", e);
          outcomes.push({
            channel,
            status: "FAILED",
            reason: e instanceof Error ? e.message : "Email send failed.",
          });
        }
        break;
      }
      case "PUSH": {
        if (!isConfigured.webPush()) {
          outcomes.push({ channel, status: "SKIPPED", reason: "Web Push is not configured (VAPID keys missing)." });
          break;
        }
        const ok = await sendPush(c, msg);
        outcomes.push(
          ok
            ? { channel, status: "SENT" }
            : { channel, status: "SKIPPED", reason: "Recipient has no active push subscription." },
        );
        break;
      }
      case "WHATSAPP": {
        if (!isConfigured.whatsapp()) {
          outcomes.push({ channel, status: "SKIPPED", reason: "WhatsApp is not configured (Meta Cloud API keys missing)." });
          break;
        }
        if (!c.phone) {
          outcomes.push({ channel, status: "SKIPPED", reason: "Recipient has no phone number." });
          break;
        }
        const ok = await sendWhatsApp(c, msg);
        outcomes.push(
          ok ? { channel, status: "SENT" } : { channel, status: "FAILED", reason: "WhatsApp send failed (see server logs)." },
        );
        break;
      }
      case "SMS": {
        if (!isConfigured.sms()) {
          outcomes.push({ channel, status: "SKIPPED", reason: "SMS is not configured (Twilio keys missing)." });
          break;
        }
        if (!c.phone) {
          outcomes.push({ channel, status: "SKIPPED", reason: "Recipient has no phone number." });
          break;
        }
        const ok = await sendSMS(c, msg);
        outcomes.push(
          ok ? { channel, status: "SENT" } : { channel, status: "FAILED", reason: "SMS send failed (see server logs)." },
        );
        break;
      }
    }
  }

  return outcomes;
}

function logStatus(outcomes: ChannelOutcome[]): "SENT" | "PARTIAL" | "FAILED" {
  const sent = outcomes.filter((o) => o.status === "SENT").length;
  if (sent === outcomes.length && sent > 0) return "SENT";
  if (sent > 0) return "PARTIAL";
  return "FAILED";
}

function firstProblem(outcomes: ChannelOutcome[]): string | null {
  const bad = outcomes.find((o) => o.status !== "SENT");
  return bad ? `${CHANNEL_LABEL[bad.channel]}: ${bad.reason ?? bad.status}` : null;
}

/** Collect rule-level warnings from a set of recipient outcomes (deduped). */
function collectNotes(all: ChannelOutcome[][], notes: Set<string>) {
  for (const outcomes of all) {
    for (const o of outcomes) {
      if (o.status === "STUBBED" || (o.status === "SKIPPED" && o.reason?.includes("not configured"))) {
        notes.add(`${CHANNEL_LABEL[o.channel]}: ${o.reason}`);
      }
    }
  }
}

/**
 * Evaluate every enabled automation rule and deliver to newly-eligible recipients.
 * Dedup is enforced by `AutomationLog` (`@@unique([ruleId, key])`), so each user
 * (or order, for post-purchase) receives a rule at most once. Every recipient's
 * per-channel outcome is persisted on their log row (the Automation History), and
 * the returned report explains each rule's result — including why nothing was sent.
 * Called by the cron dispatch route and the admin "Run now" action.
 */
export async function runAutomations(): Promise<AutomationRunReport> {
  const rules = await prisma.automationRule.findMany({ where: { enabled: true } });
  const report: AutomationRunReport = { delivered: 0, rules: [] };

  for (const rule of rules) {
    const r: RuleRunReport = {
      ruleId: rule.id,
      name: rule.name,
      trigger: rule.trigger,
      candidates: 0,
      alreadySent: 0,
      attempted: 0,
      sent: 0,
      failed: 0,
      notes: [],
    };
    report.rules.push(r);

    try {
      const candidates = await candidatesFor(rule);
      r.candidates = candidates.length;
      if (candidates.length === 0) {
        r.notes.push(emptyReason(rule));
        await prisma.automationRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date() } });
        continue;
      }

      const already = await prisma.automationLog.findMany({
        where: { ruleId: rule.id, key: { in: candidates.map((c) => c.key) } },
        select: { key: true },
      });
      const sentKeys = new Set(already.map((a) => a.key));
      r.alreadySent = sentKeys.size;
      const fresh = candidates.filter((c) => !sentKeys.has(c.key)).slice(0, PER_RUN_CAP);
      if (fresh.length === 0) {
        r.notes.push("Every eligible recipient was already messaged on a previous run (each gets a rule once).");
        await prisma.automationRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date() } });
        continue;
      }

      const notes = new Set<string>();
      const allOutcomes: ChannelOutcome[][] = [];
      for (const c of fresh) {
        let logId: string;
        try {
          // Reserve the dedup row first; a unique clash means another run took it.
          const log = await prisma.automationLog.create({
            data: { ruleId: rule.id, userId: c.userId, key: c.key, status: "FAILED" },
          });
          logId = log.id;
        } catch {
          continue;
        }
        r.attempted++;
        const outcomes = await deliverToOne(rule, c);
        allOutcomes.push(outcomes);
        const status = logStatus(outcomes);
        if (status === "FAILED") r.failed++;
        else r.sent++;
        await prisma.automationLog
          .update({
            where: { id: logId },
            data: {
              status,
              channels: outcomes.filter((o) => o.status === "SENT").map((o) => o.channel),
              error: firstProblem(outcomes),
              detail: outcomes as unknown as Prisma.InputJsonValue,
            },
          })
          .catch((e) => console.error("[marketing] automation log update failed:", e));
      }
      collectNotes(allOutcomes, notes);
      r.notes.push(...notes);

      await prisma.automationRule.update({
        where: { id: rule.id },
        data: { sentCount: { increment: r.sent }, lastRunAt: new Date() },
      });
      report.delivered += r.sent;
    } catch (err) {
      console.error("[marketing] automation rule failed:", rule.id, err);
      r.error = err instanceof Error ? err.message : "Rule evaluation failed.";
    }
  }

  return report;
}

/**
 * Send a rule's message to one specific user (the admin pressing "Test") exactly
 * as a real trigger would, without consuming the recipient's dedup slot. Logged
 * in the Automation History with status TEST.
 */
export async function testAutomationRule(
  ruleId: string,
  user: { id: string; email: string | null; name: string | null },
): Promise<{ outcomes: ChannelOutcome[] } | { error: string }> {
  const rule = await prisma.automationRule.findUnique({ where: { id: ruleId } });
  if (!rule) return { error: "Automation not found." };

  const candidate: Candidate = {
    userId: user.id,
    email: user.email,
    name: user.name,
    phone: await latestPhone(user.id),
    key: `test:${user.id}:${Date.now()}`,
  };

  const outcomes = await deliverToOne(rule, candidate);
  await prisma.automationLog
    .create({
      data: {
        ruleId: rule.id,
        userId: user.id,
        key: candidate.key,
        status: "TEST",
        channels: outcomes.filter((o) => o.status === "SENT").map((o) => o.channel),
        error: firstProblem(outcomes),
        detail: outcomes as unknown as Prisma.InputJsonValue,
      },
    })
    .catch((e) => console.error("[marketing] automation test log failed:", e));
  return { outcomes };
}
