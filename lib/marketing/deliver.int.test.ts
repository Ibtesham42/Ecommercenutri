import { hasLocalDb } from "@/lib/test/local-db-env"; // must stay first: pins DB + blanks live keys
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Campaign dispatch idempotency on a real (local, disposable) Postgres. Two
 * cron runs can overlap (e.g. the same schedule firing in two Vercel
 * projects); each due campaign — one-off or a recurring occurrence — must
 * still reach every recipient exactly once.
 *
 *   SPIN_TEST_DATABASE_URL=... npx vitest run lib/marketing/deliver.int.test.ts
 */

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), unstable_cache: (fn: () => unknown) => fn }));
vi.mock("server-only", () => ({}));
const notify = vi.fn(async () => undefined);
vi.mock("@/lib/notifications", () => ({ notify }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));

const ctx = hasLocalDb
  ? { prisma: (await import("@/lib/prisma")).prisma, deliver: await import("@/lib/marketing/deliver") }
  : null;

describe.skipIf(!ctx)("campaign dispatch idempotency (integration)", () => {
  if (!ctx) return;
  const { prisma, deliver } = ctx;
  const userIds: string[] = [];

  async function cleanup() {
    await prisma.campaign.deleteMany({ where: { name: { startsWith: "dlv-test" } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: "@deliver.test" } } });
  }

  beforeAll(async () => {
    await cleanup();
    for (const n of [1, 2, 3]) {
      const u = await prisma.user.create({ data: { email: `u${n}@deliver.test` } });
      userIds.push(u.id);
    }
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  beforeEach(() => notify.mockClear());

  const campaign = (data: { recurrence?: string; name: string }) =>
    prisma.campaign.create({
      data: {
        title: "t",
        body: "b",
        channels: ["IN_APP"],
        segmentType: "SELECTED",
        segmentConfig: { userIds },
        status: "SCHEDULED",
        scheduledFor: new Date(Date.now() - 60_000),
        ...data,
      },
    });

  it("overlapping cron runs send a one-off campaign once", async () => {
    const c = await campaign({ name: "dlv-test one-off" });
    const now = new Date();
    const [a, b] = await Promise.all([deliver.dispatchDueCampaigns(now), deliver.dispatchDueCampaigns(now)]);
    expect(a + b).toBe(1);
    expect(notify).toHaveBeenCalledTimes(userIds.length);
    expect(await prisma.campaign.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ status: "SENT", sentCount: 3 });
  });

  it("overlapping cron runs send a recurring occurrence once and re-arm the series", async () => {
    const parent = await campaign({ name: "dlv-test daily", recurrence: "DAILY" });
    const now = new Date();
    await Promise.all([deliver.dispatchDueCampaigns(now), deliver.dispatchDueCampaigns(now)]);
    expect(notify).toHaveBeenCalledTimes(userIds.length);
    const children = await prisma.campaign.count({ where: { name: { startsWith: "dlv-test daily ·" } } });
    expect(children).toBe(1);
    const p = await prisma.campaign.findUniqueOrThrow({ where: { id: parent.id } });
    expect(p.status).toBe("SCHEDULED");
    expect(p.scheduledFor!.getTime()).toBeGreaterThan(now.getTime());
  });

  it("a double-clicked Send now delivers once", async () => {
    const c = await campaign({ name: "dlv-test manual" });
    const res = await Promise.all([deliver.dispatchCampaign(c.id), deliver.dispatchCampaign(c.id)]);
    expect(res.filter((r) => r.ok)).toHaveLength(1);
    expect(res.find((r) => !r.ok)?.error).toBe("This campaign was already sent.");
    expect(notify).toHaveBeenCalledTimes(userIds.length);
    expect(await deliver.dispatchCampaign("missing-id")).toMatchObject({ ok: false, error: "Campaign not found." });
  });
});
