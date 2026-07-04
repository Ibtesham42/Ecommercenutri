import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, limiters } from "@/lib/rate-limit";
import { parseUA } from "@/lib/ua";
import { HEAT_SECTIONS, PAGE_SECTION, pageGroup } from "@/lib/heat-sections";

export const runtime = "nodejs";

/**
 * Heatmap beacon sink. The EngagementTracker batches a whole page's section
 * interactions into ONE payload (sent via sendBeacon on leave), and this route
 * folds it into daily HeatStat counters with increment-upserts — no
 * per-interaction rows, so the table stays tiny at any traffic level.
 * Anonymous by design (no user linkage). Fail-open, never blocks UX.
 */

// Per-beacon caps: one page visit can't plausibly exceed these; anything
// larger is clamped so a crafted client can't inflate the stats.
const CAP_COUNT = 50;
const CAP_TIME_MS = 5 * 60_000;

const clamp = (n: number, max: number) => Math.min(Math.max(0, Math.round(n)), max);

const sectionSchema = z.object({
  k: z.string().max(40),
  c: z.number().min(0).max(100_000).default(0), // clicks
  h: z.number().min(0).max(100_000).default(0), // hover-dwells
  t: z.number().min(0).max(10_000_000).default(0), // visible ms
  v: z.number().min(0).max(100_000).default(0), // impressions
});

const bodySchema = z.object({
  path: z.string().max(200),
  sections: z.array(sectionSchema).max(30),
  scrollDepth: z.number().min(0).max(100).default(0), // max % reached
  timeMs: z.number().min(0).max(10_000_000).default(0), // time on page
});

export async function POST(req: Request) {
  // sendBeacon posts an opaque blob — parse the text body defensively.
  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const anonId =
    req.headers.get("cookie")?.match(/(?:^|;\s*)nut_anon=([^;]+)/)?.[1] ?? "anon";
  const rl = await checkRateLimit(limiters.api, `heat:${anonId}`);
  if (!rl.success) return NextResponse.json({ ok: false }, { status: 429 });

  const { device } = parseUA(req.headers.get("user-agent") ?? "");
  const dev = device ?? "desktop";
  const page = pageGroup(parsed.data.path.split(/[?#]/)[0]);
  const day = new Date();
  day.setHours(0, 0, 0, 0);

  type Inc = { views: number; clicks: number; hovers: number; timeMs: number };
  const upserts: { section: string; inc: Inc; scroll?: number }[] = [];

  for (const s of parsed.data.sections) {
    if (!(s.k in HEAT_SECTIONS)) continue; // only known data-heat keys
    upserts.push({
      section: s.k,
      inc: {
        views: clamp(s.v, CAP_COUNT),
        clicks: clamp(s.c, CAP_COUNT),
        hovers: clamp(s.h, CAP_COUNT),
        timeMs: clamp(s.t, CAP_TIME_MS),
      },
    });
  }
  // Page-level rollup: one visit + scroll milestones + time on page.
  upserts.push({
    section: PAGE_SECTION,
    inc: { views: 1, clicks: 0, hovers: 0, timeMs: clamp(parsed.data.timeMs, CAP_TIME_MS) },
    scroll: parsed.data.scrollDepth,
  });

  try {
    await prisma.$transaction(
      upserts.map(({ section, inc, scroll }) => {
        const milestones = {
          scroll25: scroll !== undefined && scroll >= 25 ? 1 : 0,
          scroll50: scroll !== undefined && scroll >= 50 ? 1 : 0,
          scroll75: scroll !== undefined && scroll >= 75 ? 1 : 0,
          scroll100: scroll !== undefined && scroll >= 95 ? 1 : 0, // 95%+ counts as full read
        };
        return prisma.heatStat.upsert({
          where: { day_page_section_device: { day, page, section, device: dev } },
          create: { day, page, section, device: dev, ...inc, ...milestones },
          update: {
            views: { increment: inc.views },
            clicks: { increment: inc.clicks },
            hovers: { increment: inc.hovers },
            timeMs: { increment: inc.timeMs },
            ...(scroll !== undefined
              ? {
                  scroll25: { increment: milestones.scroll25 },
                  scroll50: { increment: milestones.scroll50 },
                  scroll75: { increment: milestones.scroll75 },
                  scroll100: { increment: milestones.scroll100 },
                }
              : {}),
          },
        });
      }),
    );
  } catch (err) {
    console.error("[heat] upsert failed:", err);
  }
  return NextResponse.json({ ok: true });
}
