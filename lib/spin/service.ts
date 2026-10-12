/**
 * Spin & Win engine (server-only). The browser only ever sends "spin" /
 * "claim" intents — the campaign, prize, product, stock check, discount and
 * coupon are all decided and persisted here.
 *
 * Lifecycle: AWARDED (anonymous win, claim token in an httpOnly cookie, hash
 * in the DB) → CLAIMED (attached to an account + personal single-use Coupon)
 * → REDEEMED (an order using that coupon was confirmed). An unclaimed win past
 * its claim window is EXPIRED. Signed-in shoppers go straight to CLAIMED.
 *
 * Concurrency: one spin per (campaign, user) is a DB unique constraint;
 * claims are a conditional `updateMany` on `status: AWARDED` inside a
 * transaction (loser matches 0 rows → rolls back its coupon + claim count);
 * the campaign claim cap uses the same guarded-increment pattern as
 * `confirmOrder`'s coupon usage limit. Redemption-once is the coupon's own
 * `usageLimit: 1`, enforced atomically by `confirmOrder`.
 */

import { createHash, randomBytes } from "node:crypto";
import { customAlphabet } from "nanoid";
import { Prisma, type SpinCampaign, type SpinResult } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db-retry";
import { CACHE_TAGS, cachedQuery } from "@/lib/cache";
import { resolvePrizes, type PrizeTier } from "@/lib/spin/config";
import {
  drawPrize,
  productCandidates,
  secureRandom,
  weightedPick,
  type Rng,
  type VariantStock,
} from "@/lib/spin/selection";

export const SPIN_COOKIE = "nut_spin";

/** The interactive-transaction client of our (extended) Prisma client. */
type Tx = Omit<typeof prisma, "$extends" | "$transaction" | "$connect" | "$disconnect" | "$on">;

const couponSuffix = customAlphabet("ACDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

export function newClaimToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SpinErrorCode =
  | "NO_CAMPAIGN"
  | "NO_STOCK"
  | "EXPIRED"
  | "ALREADY_CLAIMED"
  | "CLAIM_LIMIT"
  | "NOT_FOUND";

export class SpinError extends Error {
  constructor(
    public readonly code: SpinErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SpinError";
  }
}

const MESSAGES: Record<SpinErrorCode, string> = {
  NO_CAMPAIGN: "Spin & Win isn't running right now — do check back soon.",
  NO_STOCK: "All of this campaign's offer products are low on stock right now. Please try again later.",
  EXPIRED: "This win has expired. Wins must be claimed within the time shown.",
  ALREADY_CLAIMED: "You've already claimed a Spin & Win offer for this campaign.",
  CLAIM_LIMIT: "All offers for this campaign have been claimed. Thanks for playing!",
  NOT_FOUND: "We couldn't find a win to claim. Give the wheel a spin first.",
};

function fail(code: SpinErrorCode): never {
  throw new SpinError(code, MESSAGES[code]);
}

// ---------------------------------------------------------------------------
// Campaign
// ---------------------------------------------------------------------------

/** Is the campaign live at `now` (enabled, in window, claims left)? */
export function isCampaignLive(
  c: Pick<SpinCampaign, "isActive" | "startsAt" | "endsAt" | "maxClaims" | "claimCount">,
  now: Date,
): boolean {
  if (!c.isActive) return false;
  if (c.startsAt && c.startsAt > now) return false;
  if (c.endsAt && c.endsAt <= now) return false;
  if (c.maxClaims != null && c.claimCount >= c.maxClaims) return false;
  return true;
}

export async function getLiveCampaign(now = new Date()): Promise<SpinCampaign | null> {
  const rows = await withDbRetry(() =>
    prisma.spinCampaign.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } }),
  );
  return rows.find((c) => isCampaignLive(c, now) && resolvePrizes(c.prizes).some((t) => t.weight > 0)) ?? null;
}

// Storefront entry points (homepage band, /offers) only need "is a campaign
// live + its top percent" — data-cached, Date-free, time window re-checked per
// request so a cached row can't outlive its endsAt.
const readActiveCampaignWindows = cachedQuery(
  async () => {
    const rows = await prisma.spinCampaign.findMany({
      where: { isActive: true },
      select: { isActive: true, startsAt: true, endsAt: true, maxClaims: true, claimCount: true, prizes: true },
    });
    return rows.map((r) => ({
      startsAt: r.startsAt?.toISOString() ?? null,
      endsAt: r.endsAt?.toISOString() ?? null,
      maxClaims: r.maxClaims,
      claimCount: r.claimCount,
      topPercent: Math.max(0, ...resolvePrizes(r.prizes).filter((t) => t.weight > 0).map((t) => t.percent)),
    }));
  },
  "spin-active-campaigns",
  [CACHE_TAGS.spin],
);

/** Lightweight "should we show the Spin & Win entry point?" for storefront chrome. */
export async function getSpinTeaser(now = new Date()): Promise<{ topPercent: number } | null> {
  try {
    const rows = await readActiveCampaignWindows();
    const live = rows.find(
      (r) =>
        r.topPercent > 0 &&
        isCampaignLive(
          {
            isActive: true,
            startsAt: r.startsAt ? new Date(r.startsAt) : null,
            endsAt: r.endsAt ? new Date(r.endsAt) : null,
            maxClaims: r.maxClaims,
            claimCount: r.claimCount,
          },
          now,
        ),
    );
    return live ? { topPercent: live.topPercent } : null;
  } catch (err) {
    console.error("[spin] teaser read failed:", err);
    return null;
  }
}

async function loadVariantStock(
  db: Tx,
  variantIds: readonly string[],
): Promise<VariantStock[]> {
  if (variantIds.length === 0) return [];
  const rows = await db.productVariant.findMany({
    where: { id: { in: [...variantIds] } },
    select: { id: true, productId: true, stock: true, isActive: true, product: { select: { isActive: true } } },
  });
  return rows.map((v) => ({
    variantId: v.id,
    productId: v.productId,
    stock: v.stock,
    variantActive: v.isActive,
    productActive: v.product.isActive,
  }));
}

function selectionConfig(c: SpinCampaign) {
  return { eligibleVariantIds: c.eligibleVariantIds, minStock: c.minStock, weightCap: c.weightCap };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

// ---------------------------------------------------------------------------
// Spin
// ---------------------------------------------------------------------------

export type SpinOutcome = {
  spin: SpinResult;
  /** Set when a new anonymous spin was created — the caller stores it in the cookie. */
  claimToken?: string;
  /** True when this call created the spin (false = replay of an existing one). */
  created: boolean;
};

/**
 * Spin once. Replays are idempotent: a signed-in user, or an anonymous visitor
 * holding a claim cookie for this campaign, gets their existing result back —
 * never a re-roll.
 */
export async function spinWheel(input: {
  userId: string | null;
  anonId: string | null;
  claimToken: string | null;
  now?: Date;
  rng?: Rng;
}): Promise<SpinOutcome> {
  const now = input.now ?? new Date();
  const rng = input.rng ?? secureRandom;
  const campaign = await getLiveCampaign(now);
  if (!campaign) fail("NO_CAMPAIGN");

  if (input.userId) {
    const existing = await prisma.spinResult.findUnique({
      where: { campaignId_userId: { campaignId: campaign.id, userId: input.userId } },
    });
    if (existing) return { spin: existing, created: false };
  }
  if (input.claimToken) {
    const byToken = await prisma.spinResult.findUnique({ where: { tokenHash: hashToken(input.claimToken) } });
    if (byToken && byToken.campaignId === campaign.id) {
      // Signed in with an unclaimed anonymous win → claim that one, don't re-roll.
      if (input.userId && byToken.status === "AWARDED") {
        const claimed = await claimSpin({ userId: input.userId, claimToken: input.claimToken, now, rng });
        return { spin: claimed.spin, created: false };
      }
      return { spin: byToken, created: false };
    }
  }

  const tiers = resolvePrizes(campaign.prizes);
  const stock = await loadVariantStock(prisma, campaign.eligibleVariantIds);
  const prize = drawPrize(stock, selectionConfig(campaign), tiers, rng);
  if (!prize) fail("NO_STOCK");

  const expiresAt = new Date(now.getTime() + campaign.claimWindowHours * 3_600_000);

  if (input.userId) {
    const userId = input.userId;
    try {
      const spin = await prisma.$transaction(async (tx) => {
        const created = await tx.spinResult.create({
          data: {
            campaignId: campaign.id,
            userId,
            percent: prize.percent,
            productId: prize.productId,
            variantIds: prize.variantIds,
            expiresAt,
          },
        });
        return claimInTx(tx, created, campaign, userId, now, rng);
      });
      return { spin, created: true };
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Lost a race with a concurrent spin from the same account — return theirs.
        const existing = await prisma.spinResult.findUnique({
          where: { campaignId_userId: { campaignId: campaign.id, userId } },
        });
        if (existing) return { spin: existing, created: false };
      }
      throw err;
    }
  }

  const claimToken = newClaimToken();
  const spin = await prisma.spinResult.create({
    data: {
      campaignId: campaign.id,
      tokenHash: hashToken(claimToken),
      anonId: input.anonId,
      percent: prize.percent,
      productId: prize.productId,
      variantIds: prize.variantIds,
      expiresAt,
    },
  });
  return { spin, claimToken, created: true };
}

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

/**
 * Attach an anonymous win to a signed-in account and issue its coupon.
 * Re-validates expiry, the one-per-account rule, the campaign claim cap and
 * live stock (moving the offer to another in-stock eligible product at the
 * same percent if the original sold out meanwhile).
 */
export async function claimSpin(input: {
  userId: string;
  claimToken: string;
  now?: Date;
  rng?: Rng;
}): Promise<{ spin: SpinResult; reassigned: boolean }> {
  const now = input.now ?? new Date();
  const rng = input.rng ?? secureRandom;
  const spin = await prisma.spinResult.findUnique({
    where: { tokenHash: hashToken(input.claimToken) },
    include: { campaign: true },
  });
  if (!spin) fail("NOT_FOUND");
  if (spin.status !== "AWARDED") {
    if (spin.userId === input.userId) return { spin, reassigned: false }; // replay
    fail(spin.status === "EXPIRED" ? "EXPIRED" : "NOT_FOUND");
  }
  if (spin.expiresAt <= now) {
    await prisma.spinResult.updateMany({ where: { id: spin.id, status: "AWARDED" }, data: { status: "EXPIRED" } });
    fail("EXPIRED");
  }
  const mine = await prisma.spinResult.findUnique({
    where: { campaignId_userId: { campaignId: spin.campaignId, userId: input.userId } },
  });
  if (mine && mine.id !== spin.id) fail("ALREADY_CLAIMED");

  const originalProduct = spin.productId;
  try {
    const claimed = await prisma.$transaction((tx) =>
      claimInTx(tx, spin, spin.campaign, input.userId, now, rng),
    );
    return { spin: claimed, reassigned: claimed.productId !== originalProduct };
  } catch (err) {
    if (isUniqueViolation(err)) fail("ALREADY_CLAIMED");
    throw err;
  }
}

async function claimInTx(
  tx: Tx,
  spin: SpinResult,
  campaign: SpinCampaign,
  userId: string,
  now: Date,
  rng: Rng,
): Promise<SpinResult> {
  // Never promise stock that isn't there: re-check at claim time.
  const stock = await loadVariantStock(tx, campaign.eligibleVariantIds);
  const candidates = productCandidates(stock, selectionConfig(campaign));
  let target = candidates.find((c) => c.productId === spin.productId);
  if (!target) {
    const fallback = weightedPick(candidates, rng);
    if (!fallback) fail("NO_STOCK");
    target = fallback;
  }

  // Campaign claim cap — guarded increment against the row's current value.
  if (campaign.maxClaims != null) {
    const ok = await tx.spinCampaign.updateMany({
      where: { id: campaign.id, claimCount: { lt: campaign.maxClaims } },
      data: { claimCount: { increment: 1 } },
    });
    if (ok.count === 0) fail("CLAIM_LIMIT");
  } else {
    await tx.spinCampaign.update({ where: { id: campaign.id }, data: { claimCount: { increment: 1 } } });
  }

  const product = await tx.product.findUnique({ where: { id: target.productId }, select: { name: true } });
  const coupon = await tx.coupon.create({
    data: {
      code: `SPIN-${couponSuffix()}`,
      description: `Spin & Win: ${spin.percent}% off ${product?.name ?? "selected product"}`,
      type: "PERCENT",
      value: spin.percent,
      usageLimit: 1,
      perUserLimit: 1,
      ownerUserId: userId,
      productIds: [target.productId],
      variantIds: target.variantIds,
      saleMode: campaign.saleMode,
      minOrder: campaign.minOrder,
      maxDiscount: campaign.maxDiscount,
      expiresAt: new Date(now.getTime() + campaign.offerValidDays * 86_400_000),
      isActive: true,
      isPublic: false,
    },
  });

  // The claim itself: only an AWARDED spin that is unowned (anonymous) or
  // already this user's can transition. A concurrent claimer blocks on the row
  // lock, re-evaluates, matches 0 rows and rolls back everything above.
  const updated = await tx.spinResult.updateMany({
    where: { id: spin.id, status: "AWARDED", OR: [{ userId: null }, { userId }] },
    data: {
      userId,
      status: "CLAIMED",
      claimedAt: now,
      couponId: coupon.id,
      tokenHash: null,
      productId: target.productId,
      variantIds: target.variantIds,
    },
  });
  if (updated.count === 0) fail("NOT_FOUND");
  return tx.spinResult.findUniqueOrThrow({ where: { id: spin.id } });
}

// ---------------------------------------------------------------------------
// Redemption (called best-effort after an order is confirmed)
// ---------------------------------------------------------------------------

/** Mark the spin behind `couponId` REDEEMED. Returns true if it transitioned. */
export async function markSpinRedeemed(couponId: string, now = new Date()): Promise<boolean> {
  const res = await prisma.spinResult.updateMany({
    where: { couponId, status: "CLAIMED" },
    data: { status: "REDEEMED", redeemedAt: now },
  });
  return res.count > 0;
}

// ---------------------------------------------------------------------------
// Read model for the /spin page + checkout hint (no weights, no stock)
// ---------------------------------------------------------------------------

export type SpinView = {
  status: "AWARDED" | "CLAIMED" | "REDEEMED" | "EXPIRED";
  percent: number;
  productId: string;
  productName: string;
  productSlug: string;
  image: string | null;
  variantLabels: string[];
  claimBy: string; // ISO — claim deadline (AWARDED)
  coupon: { code: string; expiresAt: string | null; used: boolean } | null;
};

export type PublicCampaign = {
  id: string;
  name: string;
  percents: number[];
  endsAt: string | null;
  claimWindowHours: number;
  offerValidDays: number;
  minOrder: number | null;
  maxDiscount: number | null;
  saleMode: SpinCampaign["saleMode"];
};

export function toPublicCampaign(c: SpinCampaign): PublicCampaign {
  return {
    id: c.id,
    name: c.name,
    percents: resolvePrizes(c.prizes)
      .filter((t: PrizeTier) => t.weight > 0)
      .map((t) => t.percent),
    endsAt: c.endsAt?.toISOString() ?? null,
    claimWindowHours: c.claimWindowHours,
    offerValidDays: c.offerValidDays,
    minOrder: c.minOrder,
    maxDiscount: c.maxDiscount,
    saleMode: c.saleMode,
  };
}

export async function toSpinView(spin: SpinResult, now = new Date()): Promise<SpinView> {
  const [product, variants, coupon] = await Promise.all([
    prisma.product.findUnique({
      where: { id: spin.productId },
      select: {
        name: true,
        slug: true,
        images: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } },
      },
    }),
    prisma.productVariant.findMany({
      where: { id: { in: spin.variantIds } },
      orderBy: { weightInGrams: "asc" },
      select: { weightLabel: true },
    }),
    spin.couponId
      ? prisma.coupon.findUnique({
          where: { id: spin.couponId },
          select: { code: true, expiresAt: true, usedCount: true, isActive: true },
        })
      : null,
  ]);
  const status = spin.status === "AWARDED" && spin.expiresAt <= now ? "EXPIRED" : spin.status;
  return {
    status,
    percent: spin.percent,
    productId: spin.productId,
    productName: product?.name ?? "Selected product",
    productSlug: product?.slug ?? "",
    image: product?.images[0]?.url ?? null,
    variantLabels: variants.map((v) => v.weightLabel),
    claimBy: spin.expiresAt.toISOString(),
    coupon: coupon
      ? { code: coupon.code, expiresAt: coupon.expiresAt?.toISOString() ?? null, used: coupon.usedCount > 0 }
      : null,
  };
}

/**
 * Post-login landing hook (mirrors the quiz's claim-on-/account): attach this
 * browser's pending anonymous win to the account. Best-effort and idempotent —
 * the claim nulls the token hash, so the leftover cookie is inert.
 */
export async function claimPendingSpinForUser(userId: string, claimToken: string | undefined): Promise<boolean> {
  if (!claimToken) return false;
  try {
    const pending = await prisma.spinResult.findUnique({
      where: { tokenHash: hashToken(claimToken) },
      select: { status: true },
    });
    if (pending?.status !== "AWARDED") return false;
    await claimSpin({ userId, claimToken });
    return true;
  } catch (err) {
    if (!(err instanceof SpinError)) console.error("[spin] claim on account load failed:", err);
    return false;
  }
}

/** The signed-in user's usable (claimed, unexpired, unused) spin coupon, for checkout. */
export async function getUsableSpinOffer(
  userId: string,
  now = new Date(),
): Promise<{ code: string; label: string } | null> {
  const spin = await prisma.spinResult.findFirst({
    where: {
      userId,
      status: "CLAIMED",
      coupon: { isActive: true, usedCount: 0, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    },
    orderBy: { claimedAt: "desc" },
    include: { coupon: { select: { code: true, description: true } } },
  });
  if (!spin?.coupon) return null;
  return { code: spin.coupon.code, label: spin.coupon.description ?? `${spin.percent}% off` };
}
