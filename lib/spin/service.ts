/**
 * Spin & Win engine (server-only). The browser only ever sends "spin" /
 * "claim" intents — the campaign, prize, product, stock check, discount and
 * coupon are all decided and persisted here.
 *
 * Lifecycle: AWARDED (anonymous win, claim token in an httpOnly cookie, hash
 * in the DB) → CLAIMED (attached to an account + personal single-use Coupon)
 * → REDEEMED (an order using that coupon was confirmed). An unclaimed win past
 * its claim window is EXPIRED. Claiming needs a VERIFIED email or phone:
 * verified signed-in shoppers go straight to CLAIMED; an unverified account's
 * win is held AWARDED (bound to the account) until it verifies.
 *
 * Concurrency: one spin per (campaign, user) is a DB unique constraint;
 * claims are a conditional `updateMany` on `status: AWARDED` inside a
 * transaction (loser matches 0 rows → rolls back its coupon + claim count).
 * Claims are serialised by a transaction-scoped advisory lock so the stock
 * re-check sees every earlier claim's reservation (claims are rare; the lock
 * is held for a few short queries). The campaign claim cap is a single
 * guarded increment compared against the row's live `maxClaims` at write
 * time. Redemption-once is the coupon's own `usageLimit: 1`, enforced
 * atomically by `confirmOrder`.
 */

import { createHash, randomBytes } from "node:crypto";
import { customAlphabet } from "nanoid";
import { Prisma, type SpinCampaign, type SpinResult } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TX_OPTIONS, withDbRetry, withTxRetry } from "@/lib/db-retry";
import { CACHE_TAGS, cachedQuery } from "@/lib/cache";
import { resolvePrizes, type PrizeTier } from "@/lib/spin/config";
import { isPlaceholderEmail } from "@/lib/phone-account";
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
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "PRIZE_UNAVAILABLE"
  | "UNVERIFIED";

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
  RATE_LIMITED: "You've spun a few times already today. Please sign in to play.",
  PRIZE_UNAVAILABLE:
    "The product you won has just sold out, and no other offer product is available right now. " +
    "Your win is saved — please try claiming again a little later, before your claim deadline.",
  UNVERIFIED:
    "Please verify your email address or phone number to claim this offer. Your win is held for you until the claim deadline.",
};

function fail(code: SpinErrorCode): never {
  throw new SpinError(code, MESSAGES[code]);
}

// ---------------------------------------------------------------------------
// Claim eligibility: a verified email or a verified phone
// ---------------------------------------------------------------------------

export type Claimant = {
  email: string;
  emailVerified: Date | null;
  phone: string | null;
  phoneVerified: Date | null;
};

/**
 * Verified = the address the account holds now was confirmed through the
 * email link (changing it clears `emailVerified`), or the phone number on the
 * account was confirmed by OTP. A phone merely saved on the profile, or a
 * phone-login placeholder email, never counts.
 */
export function isVerifiedClaimant(u: Claimant | null): boolean {
  if (!u) return false;
  const email = Boolean(u.emailVerified) && !isPlaceholderEmail(u.email);
  const phone = Boolean(u.phoneVerified) && Boolean(u.phone);
  return email || phone;
}

async function loadClaimant(db: Tx, userId: string): Promise<Claimant | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true, phone: true, phoneVerified: true },
  });
}

/** Can this account claim Spin & Win offers right now? */
export async function canClaimSpin(userId: string): Promise<boolean> {
  return isVerifiedClaimant(await loadClaimant(prisma, userId));
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

/**
 * Outstanding offers per product: claimed, coupon still active, unused and
 * unexpired. Each is a promise of one unit, so selection treats it as reserved
 * stock (see lib/spin/selection.ts). Counted across campaigns — stock is shared.
 */
export async function loadReservations(db: Tx, now: Date): Promise<Map<string, number>> {
  const rows = await db.spinResult.groupBy({
    by: ["productId"],
    where: {
      status: "CLAIMED",
      coupon: { isActive: true, usedCount: 0, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.productId, r._count._all]));
}

function selectionConfig(c: SpinCampaign, reserved?: ReadonlyMap<string, number>) {
  return { eligibleVariantIds: c.eligibleVariantIds, minStock: c.minStock, weightCap: c.weightCap, reserved };
}

/** Arbitrary constant key: every Spin & Win claim takes this lock for its transaction. */
const CLAIM_LOCK_KEY = 7_220_416_001;

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
 * holding a claim cookie that resolves to a spin in the live campaign, gets
 * their existing result back — never a re-roll.
 *
 * `allowAnonymousSpin` (the rate limiter) is consulted immediately before any
 * NEW anonymous spin would be created, i.e. after the cookie has been
 * validated against the DB. A garbage, expired, claimed or stale-campaign
 * cookie resolves to nothing and therefore goes through the limiter like a
 * visitor with no cookie at all. Signed-in spins are bounded by the DB's one
 * spin per (campaign, user) instead.
 */
export async function spinWheel(input: {
  userId: string | null;
  anonId: string | null;
  claimToken: string | null;
  allowAnonymousSpin: () => Promise<boolean>;
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
      // Unverified: keep holding it on this device until the account verifies.
      if (input.userId && byToken.status === "AWARDED") {
        try {
          const claimed = await claimSpin({ userId: input.userId, claimToken: input.claimToken, now, rng });
          return { spin: claimed.spin, created: false };
        } catch (err) {
          if (err instanceof SpinError && err.code === "UNVERIFIED") return { spin: byToken, created: false };
          throw err;
        }
      }
      return { spin: byToken, created: false };
    }
  }

  // Past this point a new row will be created. Anonymous creations are
  // rate-limited no matter what cookie came with the request.
  if (!input.userId && !(await input.allowAnonymousSpin())) fail("RATE_LIMITED");

  const tiers = resolvePrizes(campaign.prizes);
  const [stock, reserved] = await Promise.all([
    loadVariantStock(prisma, campaign.eligibleVariantIds),
    loadReservations(prisma, now),
  ]);
  const prize = drawPrize(stock, selectionConfig(campaign, reserved), tiers, rng);
  if (!prize) fail("NO_STOCK");

  const expiresAt = new Date(now.getTime() + campaign.claimWindowHours * 3_600_000);

  if (input.userId) {
    const userId = input.userId;
    // Unverified accounts may play, but the win stays AWARDED (bound to the
    // account — still one spin per campaign) until a verified claim.
    const verified = await canClaimSpin(userId);
    try {
      const spin = await withTxRetry(() =>
        prisma.$transaction(async (tx) => {
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
          return verified ? claimInTx(tx, created, campaign, userId, now, rng) : created;
        }, TX_OPTIONS),
      );
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
 * Claim a win for a signed-in, verified account and issue its coupon: the
 * anonymous win behind `claimToken`, or — without a token — the account's own
 * held (AWARDED) win. Re-validates verification, expiry, the one-per-account
 * rule, the campaign claim cap and live stock (moving the offer to another
 * approved, in-stock product at the same percent if the original sold out).
 */
export async function claimSpin(input: {
  userId: string;
  claimToken?: string | null;
  now?: Date;
  rng?: Rng;
}): Promise<{ spin: SpinResult; reassigned: boolean }> {
  const now = input.now ?? new Date();
  const rng = input.rng ?? secureRandom;
  const spin = input.claimToken
    ? await prisma.spinResult.findUnique({
        where: { tokenHash: hashToken(input.claimToken) },
        include: { campaign: true },
      })
    : await prisma.spinResult.findFirst({
        where: { userId: input.userId, status: "AWARDED" },
        orderBy: { createdAt: "desc" },
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
    const claimed = await withTxRetry(() =>
      prisma.$transaction((tx) => claimInTx(tx, spin, spin.campaign, input.userId, now, rng), TX_OPTIONS),
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
  // Server-side gate, inside the transaction: only a verified account claims.
  if (!isVerifiedClaimant(await loadClaimant(tx, userId))) fail("UNVERIFIED");

  // Serialise claims so the reservation count below includes every claim that
  // committed before this one (Read Committed: each statement after the lock
  // sees them). Released automatically at commit/rollback.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CLAIM_LOCK_KEY}::bigint)`;

  // Never promise stock that isn't there: re-check stock, activity, the
  // campaign's CURRENT approved list and outstanding offers at claim time.
  const fresh = await tx.spinCampaign.findUniqueOrThrow({ where: { id: campaign.id } });
  const [stock, reserved] = await Promise.all([
    loadVariantStock(tx, fresh.eligibleVariantIds),
    loadReservations(tx, now),
  ]);
  const candidates = productCandidates(stock, selectionConfig(fresh, reserved));
  let target = candidates.find((c) => c.productId === spin.productId);
  if (!target) {
    // The won product sold out / was withdrawn: move the offer — same percent,
    // never a different discount — to another approved, available product.
    // None left → roll back; the win stays AWARDED and can be retried.
    const fallback = weightedPick(candidates, rng);
    if (!fallback) fail("PRIZE_UNAVAILABLE");
    target = fallback;
  }

  // Campaign claim cap — one atomic increment compared against the row's live
  // `maxClaims` at write time (an admin lowering the cap mid-flight counts).
  const capped = await tx.spinCampaign.updateMany({
    where: {
      id: campaign.id,
      OR: [{ maxClaims: null }, { claimCount: { lt: tx.spinCampaign.fields.maxClaims } }],
    },
    data: { claimCount: { increment: 1 } },
  });
  if (capped.count === 0) fail("CLAIM_LIMIT");

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
      saleMode: fresh.saleMode,
      minOrder: fresh.minOrder,
      maxDiscount: fresh.maxDiscount,
      expiresAt: new Date(now.getTime() + fresh.offerValidDays * 86_400_000),
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
      ...(target.productId !== spin.productId ? { reassignedFromProductId: spin.productId } : {}),
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
  /** Name of the originally won product when the offer was moved at claim time. */
  reassignedFrom: string | null;
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
  const [product, variants, coupon, original] = await Promise.all([
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
    spin.reassignedFromProductId
      ? prisma.product.findUnique({ where: { id: spin.reassignedFromProductId }, select: { name: true } })
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
    reassignedFrom: spin.reassignedFromProductId ? (original?.name ?? "The product you won") : null,
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
