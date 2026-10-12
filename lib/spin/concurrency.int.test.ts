import { hasLocalDb } from "@/lib/test/local-db-env"; // must stay first: pins DB + blanks live keys
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * TRUE CONCURRENCY tests for Spin & Win against a real multi-connection
 * Postgres (local, disposable — see lib/test/local-db-env.ts):
 *
 *   SPIN_TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5434/spin_test?sslmode=disable&connection_limit=30" \
 *     npx vitest run lib/spin/concurrency.int.test.ts
 *
 * Every race fires all requests at once through a connection pool, and a
 * sampler polls pg_stat_activity while it runs; each test asserts that
 * several backends really were inside the database at the same moment, so a
 * pass can't come from requests quietly running one after another. (Claims
 * are deliberately serialised INSIDE Postgres by an advisory lock — they
 * still arrive and wait concurrently, which is what the sampler sees.)
 */

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: () => unknown) => fn }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/pdf/invoice-pdf", () => ({ renderInvoiceBuffer: vi.fn(async () => Buffer.from("")) }));

const ctx = hasLocalDb
  ? {
      prisma: (await import("@/lib/prisma")).prisma,
      svc: await import("@/lib/spin/service"),
      guard: await import("@/lib/spin/checkout-guard"),
      orders: await import("@/lib/orders"),
      retry: await import("@/lib/db-retry"),
    }
  : null;

describe.skipIf(!ctx)("Spin & Win — true parallel execution (multi-connection Postgres)", () => {
  if (!ctx) return;
  const { prisma } = ctx;
  const { SpinError, spinWheel, claimSpin } = ctx.svc;
  const { placeOrderWithSingleUseOffer, orderFingerprint, STALE_PENDING_MS } = ctx.guard;
  const { confirmOrder, OrderFulfillmentError } = ctx.orders;
  const { isTransientTxError, withTxRetry } = ctx.retry;

  const allow = async () => true;
  const ids = { cat: "", A: "", C: "", a1: "", c1: "" };
  let campaignId = "";
  let seq = 0;

  const user = (verified = true) =>
    prisma.user.create({
      data: { email: `cc${Date.now()}-${seq++}@spin.test`, emailVerified: verified ? new Date() : null },
    });

  async function code(p: Promise<unknown>): Promise<string> {
    try {
      await p;
      return "OK";
    } catch (e) {
      if (e instanceof SpinError) return e.code;
      if (e instanceof OrderFulfillmentError) return e.reason;
      throw e;
    }
  }

  /**
   * Run `tasks` all at once while sampling how many OTHER backends of this
   * database are active / mid-transaction. Returns results + the peak overlap.
   */
  async function race<T>(tasks: (() => Promise<T>)[]): Promise<{ results: T[]; peak: number }> {
    let done = false;
    let peak = 0;
    const sampler = (async () => {
      while (!done) {
        const rows = await prisma.$queryRaw<{ n: bigint }[]>`
          SELECT count(*)::bigint AS n FROM pg_stat_activity
          WHERE datname = current_database() AND pid <> pg_backend_pid()
            AND state IN ('active', 'idle in transaction')`;
        peak = Math.max(peak, Number(rows[0].n));
        await new Promise((r) => setTimeout(r, 2));
      }
    })();
    try {
      const results = await Promise.all(tasks.map((t) => t()));
      return { results, peak };
    } finally {
      done = true;
      await sampler;
    }
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE "SpinResult", "SpinCampaign" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE "Order" CASCADE`); // disposable local DB only
    await prisma.coupon.deleteMany({ where: { OR: [{ code: { startsWith: "SPIN-" } }, { code: { startsWith: "CC-" } }] } });
    await prisma.user.deleteMany({ where: { email: { endsWith: "@spin.test" } } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: "cc-test-" } } });
    await prisma.category.deleteMany({ where: { slug: "cc-test-cat" } });
    const cat = await prisma.category.create({ data: { name: "cc", slug: "cc-test-cat" } });
    const mk = (slug: string, stock: number) =>
      prisma.product.create({
        data: {
          name: slug,
          slug: `cc-test-${slug}`,
          description: "t",
          categoryId: cat.id,
          variants: { create: [{ weightLabel: "100g", price: 50000, stock }] },
        },
        include: { variants: true },
      });
    const A = await mk("a", 100);
    const C = await mk("c", 100);
    Object.assign(ids, { cat: cat.id, A: A.id, C: C.id, a1: A.variants[0].id, c1: C.variants[0].id });
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE "SpinResult", "SpinCampaign" CASCADE`);
    await prisma.productVariant.updateMany({ where: { id: { in: [ids.a1, ids.c1] } }, data: { stock: 100 } });
    const c = await prisma.spinCampaign.create({
      data: {
        name: "cc",
        isActive: true,
        prizes: [{ percent: 15, weight: 1 }],
        eligibleVariantIds: [ids.a1, ids.c1],
        minStock: 5,
        weightCap: 1000,
        claimWindowHours: 24,
        offerValidDays: 7,
      },
    });
    campaignId = c.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("harness: requests genuinely run on separate connections at the same time", async () => {
    const t0 = Date.now();
    const { results, peak } = await race(
      Array.from({ length: 8 }, () => () =>
        prisma.$transaction(async (tx) => {
          const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
          await tx.$executeRaw`SELECT pg_sleep(0.3)`;
          return pid;
        }),
      ),
    );
    const elapsed = Date.now() - t0;
    expect(new Set(results).size).toBe(8); // 8 distinct server backends
    expect(elapsed).toBeLessThan(8 * 300); // overlapped, not 8 × 300 ms back to back
    expect(peak).toBeGreaterThanOrEqual(4);
  });

  it("duplicate spins: 20 simultaneous signed-in spins → exactly one spin, one coupon", async () => {
    const u = await user();
    const { results, peak } = await race(
      Array.from({ length: 20 }, () => () =>
        spinWheel({ userId: u.id, anonId: null, claimToken: null, allowAnonymousSpin: allow }),
      ),
    );
    expect(peak).toBeGreaterThanOrEqual(2);
    expect(new Set(results.map((r) => r.spin.id)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(await prisma.spinResult.count({ where: { userId: u.id } })).toBe(1);
    expect(await prisma.coupon.count({ where: { ownerUserId: u.id } })).toBe(1);
    expect((await prisma.spinCampaign.findUniqueOrThrow({ where: { id: campaignId } })).claimCount).toBe(1);
  });

  it("duplicate spins: 15 simultaneous replays of one anonymous cookie never re-roll", async () => {
    const first = await spinWheel({ userId: null, anonId: "x", claimToken: null, allowAnonymousSpin: allow });
    const { results, peak } = await race(
      Array.from({ length: 15 }, () => () =>
        spinWheel({ userId: null, anonId: "x", claimToken: first.claimToken!, allowAnonymousSpin: allow }),
      ),
    );
    expect(peak).toBeGreaterThanOrEqual(2);
    expect(results.every((r) => !r.created && r.spin.id === first.spin.id)).toBe(true);
    expect(await prisma.spinResult.count()).toBe(1);
  });

  it("duplicate claims: 12 accounts claim one win at once → exactly one coupon", async () => {
    const s = await spinWheel({ userId: null, anonId: "y", claimToken: null, allowAnonymousSpin: allow });
    const users = await Promise.all(Array.from({ length: 12 }, () => user()));
    const { results, peak } = await race(users.map((u) => () => code(claimSpin({ userId: u.id, claimToken: s.claimToken! }))));
    expect(peak).toBeGreaterThanOrEqual(2);
    expect(results.filter((r) => r === "OK")).toHaveLength(1);
    expect(results.filter((r) => r !== "OK").every((r) => r === "NOT_FOUND" || r === "ALREADY_CLAIMED")).toBe(true);
    expect(await prisma.coupon.count({ where: { ownerUserId: { in: users.map((u) => u.id) } } })).toBe(1);
    expect((await prisma.spinCampaign.findUniqueOrThrow({ where: { id: campaignId } })).claimCount).toBe(1);
  });

  it("duplicate claims: one account double-submitting its claim 10× gets one coupon", async () => {
    const u = await user();
    const s = await spinWheel({ userId: null, anonId: "z", claimToken: null, allowAnonymousSpin: allow });
    const { results, peak } = await race(Array.from({ length: 10 }, () => () => code(claimSpin({ userId: u.id, claimToken: s.claimToken! }))));
    expect(peak).toBeGreaterThanOrEqual(2);
    expect(results.filter((r) => r === "OK").length).toBeGreaterThanOrEqual(1);
    expect(await prisma.coupon.count({ where: { ownerUserId: u.id } })).toBe(1);
    expect((await prisma.spinCampaign.findUniqueOrThrow({ where: { id: campaignId } })).claimCount).toBe(1);
  });

  it("claim cap: 12 different wins claimed at once against maxClaims=3 → exactly 3", async () => {
    await prisma.spinCampaign.update({ where: { id: campaignId }, data: { maxClaims: 3 } });
    const wins = [];
    for (let i = 0; i < 12; i++) {
      wins.push(await spinWheel({ userId: null, anonId: `cap${i}`, claimToken: null, allowAnonymousSpin: allow }));
    }
    const users = await Promise.all(wins.map(() => user()));
    const { results, peak } = await race(
      wins.map((w, i) => () => code(claimSpin({ userId: users[i].id, claimToken: w.claimToken! }))),
    );
    expect(peak).toBeGreaterThanOrEqual(2);
    expect(results.filter((r) => r === "OK")).toHaveLength(3);
    expect(results.filter((r) => r === "CLAIM_LIMIT")).toHaveLength(9);
    expect((await prisma.spinCampaign.findUniqueOrThrow({ where: { id: campaignId } })).claimCount).toBe(3);
    expect(await prisma.coupon.count({ where: { ownerUserId: { in: users.map((u) => u.id) } } })).toBe(3);
    expect(await prisma.spinResult.count({ where: { campaignId, status: "AWARDED" } })).toBe(9); // losers keep their win
  });

  it("claim cap lowered by an admin mid-flight is honoured at write time", async () => {
    await prisma.spinCampaign.update({ where: { id: campaignId }, data: { maxClaims: 10 } });
    const wins = [];
    for (let i = 0; i < 6; i++) {
      wins.push(await spinWheel({ userId: null, anonId: `low${i}`, claimToken: null, allowAnonymousSpin: allow }));
    }
    const users = await Promise.all(wins.map(() => user()));
    const { results } = await race([
      ...wins.map((w, i) => () => code(claimSpin({ userId: users[i].id, claimToken: w.claimToken! }))),
      async () => {
        await prisma.spinCampaign.update({ where: { id: campaignId }, data: { maxClaims: 2 } });
        return "ADMIN";
      },
    ]);
    const claimCount = (await prisma.spinCampaign.findUniqueOrThrow({ where: { id: campaignId } })).claimCount;
    // Whatever the interleaving, claims never exceed the cap in force when each claim wrote.
    expect(results.filter((r) => r === "OK").length).toBe(claimCount);
    expect(claimCount).toBeLessThanOrEqual(6);
    if (claimCount > 2) {
      // Only possible for claims that committed before the admin's update.
      expect(results.slice(0, 6).filter((r) => r === "CLAIM_LIMIT").length).toBe(6 - claimCount);
    }
  });

  it("stock allocation: 10 simultaneous claims never promise more units than the surplus", async () => {
    // A: stock 8 → surplus 3; C: stock 7 → surplus 2. Total promisable = 5.
    const wins = [];
    for (let i = 0; i < 10; i++) {
      wins.push(await spinWheel({ userId: null, anonId: `st${i}`, claimToken: null, allowAnonymousSpin: allow, rng: () => 0.01 }));
    }
    await prisma.productVariant.update({ where: { id: ids.a1 }, data: { stock: 8 } });
    await prisma.productVariant.update({ where: { id: ids.c1 }, data: { stock: 7 } });
    const users = await Promise.all(wins.map(() => user()));
    const { results, peak } = await race(
      wins.map((w, i) => () => code(claimSpin({ userId: users[i].id, claimToken: w.claimToken! }))),
    );
    expect(peak).toBeGreaterThanOrEqual(2);
    expect(results.filter((r) => r === "OK")).toHaveLength(5);
    expect(results.filter((r) => r === "PRIZE_UNAVAILABLE")).toHaveLength(5);
    const claimed = await prisma.spinResult.findMany({ where: { status: "CLAIMED" } });
    expect(claimed.filter((c) => c.productId === ids.A)).toHaveLength(3);
    expect(claimed.filter((c) => c.productId === ids.C)).toHaveLength(2);
    // Every moved offer kept its percent and records where it came from.
    for (const c of claimed) {
      expect(c.percent).toBe(15);
      if (c.productId !== wins.find((w) => w.spin.id === c.id)!.spin.productId) {
        expect(c.reassignedFromProductId).toBeTruthy();
      }
    }
    // The unlucky five are still held (retryable), not lost.
    expect(await prisma.spinResult.count({ where: { status: "AWARDED" } })).toBe(5);
  });

  // ---------------------------------------------------------------------------
  // Duplicate order / coupon use
  // ---------------------------------------------------------------------------

  async function offerFor(userId: string) {
    return prisma.coupon.create({
      data: {
        code: `CC-${Date.now()}-${seq++}`,
        type: "PERCENT",
        value: 15,
        usageLimit: 1,
        perUserLimit: 1,
        ownerUserId: userId,
        variantIds: [ids.a1],
      },
    });
  }
  const orderData = (userId: string, couponId: string, n: number) => ({
    orderNumber: `CC-ORD-${Date.now()}-${seq++}`,
    userId,
    subtotal: 50000 * n,
    discount: 7500,
    total: 50000 * n - 7500,
    couponId,
    shippingAddress: {},
    paymentMethod: "RAZORPAY" as const,
    items: { create: [{ variantId: ids.a1, productId: ids.A, productName: "a", variantLabel: "100g", price: 50000, quantity: n }] },
  });
  const fp = (n: number) =>
    orderFingerprint({ items: [{ variantId: ids.a1, quantity: n, price: 50000 }], total: 50000 * n - 7500, addressId: null, paymentMethod: "RAZORPAY" });
  const neverPaid = async () => ({ state: "UNPAID" as const });

  it("single-use offer: 10 simultaneous different checkouts → one order, nine refused", async () => {
    const u = await user();
    const coupon = await offerFor(u.id);
    const { results, peak } = await race(
      Array.from({ length: 10 }, (_, i) => () =>
        placeOrderWithSingleUseOffer({
          couponId: coupon.id,
          userId: u.id,
          paymentMethod: "RAZORPAY",
          fingerprint: fp(i + 1),
          create: (tx) => tx.order.create({ data: orderData(u.id, coupon.id, i + 1) }),
          probe: neverPaid,
        }),
      ),
    );
    expect(peak).toBeGreaterThanOrEqual(2);
    expect(results.filter((r) => r.kind === "created")).toHaveLength(1);
    expect(results.filter((r) => r.kind === "blocked")).toHaveLength(9);
    expect(await prisma.order.count({ where: { couponId: coupon.id } })).toBe(1);
  });

  it("single-use offer: retries of the SAME checkout reopen one payment instead of creating orders", async () => {
    const u = await user();
    const coupon = await offerFor(u.id);
    const attempt = () =>
      placeOrderWithSingleUseOffer({
        couponId: coupon.id,
        userId: u.id,
        paymentMethod: "RAZORPAY",
        fingerprint: fp(1),
        create: (tx) => tx.order.create({ data: orderData(u.id, coupon.id, 1) }),
        probe: neverPaid,
      });
    const first = await race(Array.from({ length: 6 }, () => attempt));
    expect(first.results.filter((r) => r.kind === "created")).toHaveLength(1);
    expect(await prisma.order.count({ where: { couponId: coupon.id } })).toBe(1);
    // The gateway order now exists (createOrder sets it after the insert).
    const order = await prisma.order.findFirstOrThrow({ where: { couponId: coupon.id } });
    await prisma.order.update({ where: { id: order.id }, data: { razorpayOrderId: "order_test_1" } });
    const retries = await race(Array.from({ length: 6 }, () => attempt));
    expect(retries.peak).toBeGreaterThanOrEqual(2);
    expect(retries.results.every((r) => r.kind === "reuse" && r.order.id === order.id && r.order.razorpayOrderId === "order_test_1")).toBe(true);
    expect(await prisma.order.count({ where: { couponId: coupon.id } })).toBe(1);
  });

  it("stale pending orders (>30 min): ignored only when verified unpaid; never cancelled", async () => {
    const u = await user();
    const coupon = await offerFor(u.id);
    const old = await prisma.order.create({
      data: { ...orderData(u.id, coupon.id, 1), razorpayOrderId: "order_old", createdAt: new Date(Date.now() - STALE_PENDING_MS - 60_000) },
    });
    const tryWith = (probe: Parameters<typeof placeOrderWithSingleUseOffer>[0]["probe"], reconcile = vi.fn()) =>
      placeOrderWithSingleUseOffer({
        couponId: coupon.id,
        userId: u.id,
        paymentMethod: "RAZORPAY",
        fingerprint: fp(2),
        create: (tx) => tx.order.create({ data: orderData(u.id, coupon.id, 2) }),
        probe,
        reconcile,
      });

    // Uncertain (authorised / API error) → keeps the offer, nothing touched.
    expect((await tryWith(async () => ({ state: "UNCERTAIN" }))).kind).toBe("blocked");
    // Captured → reconciled through the normal confirm path, still refused.
    const reconcile = vi.fn();
    expect((await tryWith(async () => ({ state: "CAPTURED", paymentId: "pay_1" }), reconcile)).kind).toBe("blocked");
    expect(reconcile).toHaveBeenCalledWith(old.id, "pay_1");
    expect(await prisma.order.count({ where: { couponId: coupon.id } })).toBe(1);

    // Verified unpaid → 5 simultaneous checkouts: exactly one new order.
    const { results, peak } = await race(Array.from({ length: 5 }, () => () => tryWith(neverPaid)));
    expect(peak).toBeGreaterThanOrEqual(2);
    expect(results.filter((r) => r.kind === "created")).toHaveLength(1);
    expect(await prisma.order.count({ where: { couponId: coupon.id } })).toBe(2);
    // The stale order was ignored, not cancelled.
    expect(await prisma.order.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({ status: "PENDING", paymentStatus: "PENDING" });
  });

  it("a captured-but-unconfirmed order (manual review) always holds the offer", async () => {
    const u = await user();
    const coupon = await offerFor(u.id);
    await prisma.order.create({
      data: { ...orderData(u.id, coupon.id, 1), razorpayOrderId: "order_r", razorpayPaymentId: "pay_r", createdAt: new Date(Date.now() - 2 * STALE_PENDING_MS) },
    });
    const res = await placeOrderWithSingleUseOffer({
      couponId: coupon.id,
      userId: u.id,
      paymentMethod: "RAZORPAY",
      fingerprint: fp(3),
      create: (tx) => tx.order.create({ data: orderData(u.id, coupon.id, 3) }),
      probe: neverPaid,
    });
    expect(res.kind).toBe("blocked");
  });

  it("last line of defence: two orders confirmed at once with one single-use coupon → one wins", async () => {
    const u = await user();
    const coupon = await offerFor(u.id);
    const [o1, o2] = await Promise.all([
      prisma.order.create({ data: { ...orderData(u.id, coupon.id, 1), paymentMethod: "COD" } }),
      prisma.order.create({ data: { ...orderData(u.id, coupon.id, 1), paymentMethod: "COD" } }),
    ]);
    const { results, peak } = await race([o1, o2].map((o) => () => code(confirmOrder(o.id, { paymentStatus: "PENDING" }))));
    expect(peak).toBeGreaterThanOrEqual(2);
    expect(results.sort()).toEqual(["COUPON_LIMIT_REACHED", "OK"]);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: ids.a1 } })).stock).toBe(99); // decremented once
  });

  it("the same order confirmed 8× at once (success page + webhook retries) deducts stock once", async () => {
    const u = await user();
    const coupon = await offerFor(u.id);
    const o = await prisma.order.create({ data: orderData(u.id, coupon.id, 2) });
    const { peak } = await race(Array.from({ length: 8 }, () => () => code(confirmOrder(o.id, { paymentStatus: "PAID", payment: { paymentId: "pay_x" } }))));
    expect(peak).toBeGreaterThanOrEqual(2);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: ids.a1 } })).stock).toBe(98);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // O2: a REAL Postgres deadlock is recognised and retried safely
  // ---------------------------------------------------------------------------

  it("real deadlock: Prisma's error is classified transient and the bounded retry completes both", async () => {
    const lockInOrder = (first: string, second: string, gate: { arrived: number }) => () =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE "ProductVariant" SET stock = stock WHERE id = ${first}`;
        gate.arrived++;
        while (gate.arrived < 2) await new Promise((r) => setTimeout(r, 5));
        await tx.$executeRaw`UPDATE "ProductVariant" SET stock = stock WHERE id = ${second}`;
        return "done";
      });

    // Without retry: Postgres aborts one side with a deadlock.
    const gate1 = { arrived: 0 };
    const raw = await Promise.allSettled([lockInOrder(ids.a1, ids.c1, gate1)(), lockInOrder(ids.c1, ids.a1, gate1)()]);
    const failed = raw.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(failed).toHaveLength(1);
    expect(isTransientTxError(failed[0].reason)).toBe(true);

    // With the bounded retry: the aborted side re-runs and both complete.
    const gate2 = { arrived: 0 };
    const retried = await Promise.all([
      withTxRetry(lockInOrder(ids.a1, ids.c1, gate2)),
      withTxRetry(lockInOrder(ids.c1, ids.a1, gate2)),
    ]);
    expect(retried).toEqual(["done", "done"]);
  });
});
