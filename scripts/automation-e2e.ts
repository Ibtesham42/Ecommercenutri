/**
 * Rerunnable E2E test for the marketing automation engine. Run with:
 *   npx tsx --tsconfig scripts/tsconfig-e2e.json scripts/automation-e2e.ts
 *
 * Safety: disables all real rules for the duration, uses only IN_APP/PUSH channels
 * (never EMAIL — Resend is live), pre-seeds dedup logs for every real user/order so
 * no real customer can be messaged, and deletes every fixture in a finally block.
 */
import { prisma } from "../lib/prisma";
import { runAutomations, testAutomationRule } from "../lib/marketing/automation";

const H = 3_600_000;
const D = 86_400_000;
const now = Date.now();
let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++;
    console.log("  PASS", name);
  } else {
    fail++;
    console.log("  FAIL", name, extra !== undefined ? JSON.stringify(extra) : "");
  }
}

async function main() {
  const prevEnabled = await prisma.automationRule.findMany({
    where: { enabled: true },
    select: { id: true },
  });
  const ruleIds: string[] = [];
  const userIds: string[] = [];
  const orderIds: string[] = [];

  try {
    // ── Setup ──────────────────────────────────────────────────────────────
    await prisma.automationRule.updateMany({ where: { enabled: true }, data: { enabled: false } });

    const mkUser = (tag: string, createdAt: Date) =>
      prisma.user.create({
        data: {
          name: `AUTOTEST ${tag}`,
          email: `autotest-${tag}-${now}@example.com`,
          createdAt,
          role: "USER",
          isActive: true,
        },
      });

    const u1 = await mkUser("welcome", new Date(now - 2 * H)); // eligible: welcome, delay 1h
    const u2 = await mkUser("cart", new Date(now - 5 * D)); // eligible: abandoned cart (via UserEvent)
    const u3 = await mkUser("winback", new Date(now - 90 * D)); // eligible: winback (order 60d ago)
    const u4 = await mkUser("postpurchase", new Date(now - 60 * D)); // eligible: post-purchase (delivered 2d ago)
    const u5 = await mkUser("partial", new Date(now - 3 * H)); // eligible: welcome; IN_APP+PUSH rule → PARTIAL
    userIds.push(u1.id, u2.id, u3.id, u4.id, u5.id);

    // Signals
    await prisma.userEvent.create({
      data: { type: "CART_ADD", userId: u2.id, createdAt: new Date(now - 2 * H) },
    });
    const o3 = await prisma.order.create({
      data: {
        orderNumber: `AUTOTEST-${now}-1`,
        userId: u3.id,
        subtotal: 10000,
        total: 10000,
        shippingAddress: {},
        createdAt: new Date(now - 60 * D),
      },
    });
    const o4 = await prisma.order.create({
      data: {
        orderNumber: `AUTOTEST-${now}-2`,
        userId: u4.id,
        subtotal: 10000,
        total: 10000,
        status: "DELIVERED",
        shippingAddress: {},
        createdAt: new Date(now - 3 * D),
      },
    });
    orderIds.push(o3.id, o4.id);
    await prisma.orderEvent.create({
      data: { orderId: o4.id, status: "DELIVERED", createdAt: new Date(now - 2 * D) },
    });

    const mkRule = (
      name: string,
      trigger: "WELCOME" | "ABANDONED_CART" | "WINBACK" | "POST_PURCHASE",
      delayHours: number,
      channels: ("IN_APP" | "PUSH")[],
    ) =>
      prisma.automationRule.create({
        data: {
          name: `AUTOTEST ${name}`,
          trigger,
          enabled: true,
          delayHours,
          channels,
          title: `AUTOTEST ${name}`,
          body: "Automated engine test message.",
        },
      });

    const r1 = await mkRule("welcome", "WELCOME", 1, ["IN_APP"]);
    const r2 = await mkRule("cart", "ABANDONED_CART", 1, ["IN_APP"]);
    const r3 = await mkRule("winback", "WINBACK", 720, ["IN_APP"]);
    const r4 = await mkRule("postpurchase", "POST_PURCHASE", 24, ["IN_APP"]);
    const r5 = await mkRule("partial", "WELCOME", 1, ["IN_APP", "PUSH"]);
    ruleIds.push(r1.id, r2.id, r3.id, r4.id, r5.id);

    // Pre-seed dedup logs: every user except each rule's intended target, so no
    // real customer (or sibling fixture) is messaged by the test run.
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    const seedUsers = async (ruleId: string, exceptUserId: string) =>
      prisma.automationLog.createMany({
        data: allUsers
          .filter((u) => u.id !== exceptUserId)
          .map((u) => ({ ruleId, userId: u.id, key: u.id })),
        skipDuplicates: true,
      });
    await seedUsers(r1.id, u1.id);
    await seedUsers(r2.id, u2.id);
    await seedUsers(r3.id, u3.id);
    await seedUsers(r5.id, u5.id);
    const allOrders = await prisma.order.findMany({ select: { id: true, userId: true } });
    await prisma.automationLog.createMany({
      data: allOrders
        .filter((o) => o.id !== o4.id)
        .map((o) => ({ ruleId: r4.id, userId: o.userId, key: o.id })),
      skipDuplicates: true,
    });

    // ── Run 1: every trigger fires exactly for its fixture ────────────────
    console.log("\nRun 1 — first evaluation:");
    const report1 = await runAutomations();
    const by = new Map(report1.rules.map((r) => [r.ruleId, r]));

    check("WELCOME sent=1", by.get(r1.id)?.sent === 1, by.get(r1.id));
    check("ABANDONED_CART (via CART_ADD event) sent=1", by.get(r2.id)?.sent === 1, by.get(r2.id));
    check("WINBACK sent=1", by.get(r3.id)?.sent === 1, by.get(r3.id));
    check("POST_PURCHASE sent=1", by.get(r4.id)?.sent === 1, by.get(r4.id));
    check("PARTIAL rule sent=1", by.get(r5.id)?.sent === 1, by.get(r5.id));
    check(
      "PARTIAL rule notes flag unconfigured Push",
      (by.get(r5.id)?.notes ?? []).some((n) => n.toLowerCase().includes("push")),
      by.get(r5.id)?.notes,
    );

    const log1 = await prisma.automationLog.findUnique({
      where: { ruleId_key: { ruleId: r1.id, key: u1.id } },
    });
    check("welcome log status SENT", log1?.status === "SENT", log1?.status);
    check("welcome log channels [IN_APP]", JSON.stringify(log1?.channels) === '["IN_APP"]', log1?.channels);
    check("welcome log has per-channel detail", Array.isArray(log1?.detail), log1?.detail);

    const log2 = await prisma.automationLog.findUnique({
      where: { ruleId_key: { ruleId: r2.id, key: u2.id } },
    });
    check("cart log exists + SENT", log2?.status === "SENT", log2?.status);

    const log5 = await prisma.automationLog.findUnique({
      where: { ruleId_key: { ruleId: r5.id, key: u5.id } },
    });
    check("partial log status PARTIAL", log5?.status === "PARTIAL", log5?.status);
    check("partial log records the Push issue", !!log5?.error && /push/i.test(log5.error), log5?.error);

    const notifCount = await prisma.notification.count({
      where: { userId: { in: userIds }, title: { startsWith: "AUTOTEST" } },
    });
    check("in-app notifications created for all 5 fixtures", notifCount === 5, notifCount);

    const r1After = await prisma.automationRule.findUnique({ where: { id: r1.id } });
    check("rule sentCount incremented", r1After?.sentCount === 1, r1After?.sentCount);
    check("rule lastRunAt stamped", !!r1After?.lastRunAt, r1After?.lastRunAt);

    // ── Run 2: dedup — nothing sends twice, and the report says why ───────
    console.log("\nRun 2 — dedup:");
    const report2 = await runAutomations();
    const by2 = new Map(report2.rules.map((r) => [r.ruleId, r]));
    check("run 2 delivers 0", report2.delivered === 0, report2.delivered);
    check("welcome attempted=0 on rerun", by2.get(r1.id)?.attempted === 0, by2.get(r1.id));
    check(
      "rerun explains dedup",
      (by2.get(r1.id)?.notes ?? []).some((n) => n.includes("already messaged")),
      by2.get(r1.id)?.notes,
    );

    // ── Test send (the admin "Send test to me" path) ──────────────────────
    console.log("\nTest send:");
    const t = await testAutomationRule(r1.id, { id: u1.id, email: u1.email, name: u1.name });
    check("test send returns outcomes", "outcomes" in t, t);
    if ("outcomes" in t) {
      const inApp = t.outcomes.find((o) => o.channel === "IN_APP");
      check("test in-app delivered", inApp?.status === "SENT", t.outcomes);
    }
    const testLog = await prisma.automationLog.findFirst({
      where: { ruleId: r1.id, status: "TEST" },
    });
    check("TEST history row written", !!testLog, testLog?.status);
    check(
      "test send did NOT consume the dedup slot",
      (await prisma.automationLog.count({ where: { ruleId: r1.id, key: u1.id } })) === 1,
    );
  } finally {
    // ── Cleanup (fixtures + restore real rule state) ───────────────────────
    console.log("\nCleanup…");
    await prisma.automationRule.deleteMany({ where: { id: { in: ruleIds } } }); // cascades logs
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } }); // cascades order events
    await prisma.userEvent.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }); // cascades notifications
    await prisma.automationRule.updateMany({
      where: { id: { in: prevEnabled.map((r) => r.id) } },
      data: { enabled: true },
    });
    const leftoverRules = await prisma.automationRule.count({ where: { name: { startsWith: "AUTOTEST" } } });
    const leftoverUsers = await prisma.user.count({ where: { email: { startsWith: "autotest-" } } });
    console.log(`Leftover fixtures: rules=${leftoverRules} users=${leftoverUsers} (want 0/0)`);
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main().finally(() => prisma.$disconnect());
