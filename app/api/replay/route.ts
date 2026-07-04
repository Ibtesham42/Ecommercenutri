import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, limiters } from "@/lib/rate-limit";
import { parseUA } from "@/lib/ua";

export const runtime = "nodejs";

/**
 * Session-replay beacon sink. The EngagementTracker records a SAMPLED subset of
 * sessions as normalized pointer/scroll/click samples — coordinates and paths
 * only, never DOM content, text, or keystrokes, so passwords/payment/personal
 * data cannot appear in a recording by construction. One chunk arrives per
 * page (sendBeacon on leave) and is appended to the session's row.
 */

const MAX_PAGES = 12;
const MAX_BYTES = 250_000; // per session — a few KB per page in practice

// [dt, kind, a, b] — dt ms since page start; kind 0=move 1=click 2=scroll;
// a/b are x/y in 0-1000 viewport permille (scroll: a = depth %).
const evSchema = z.tuple([
  z.number().min(0).max(3_600_000),
  z.number().min(0).max(2),
  z.number().min(0).max(1000),
  z.number().min(0).max(1000).optional(),
]);

const bodySchema = z.object({
  id: z.string().regex(/^[a-f0-9][a-f0-9-]{15,39}$/i),
  cid: z.string().regex(/^[a-f0-9-]{16,64}$/i).optional(),
  path: z.string().max(200),
  w: z.number().min(200).max(5000),
  h: z.number().min(200).max(5000),
  dur: z.number().min(0).max(3_600_000),
  ev: z.array(evSchema).max(900),
  clicks: z.number().min(0).max(500).default(0),
  rage: z.number().min(0).max(100).default(0),
});

type PageChunk = {
  path: string;
  t: number; // page index order is enough; t = offset ms from session start
  w: number;
  h: number;
  dur: number;
  ev: [number, number, number, number?][];
};

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const anonId =
    parsed.data.cid ??
    req.headers.get("cookie")?.match(/(?:^|;\s*)nut_anon=([^;]+)/)?.[1] ??
    null;
  const rl = await checkRateLimit(limiters.api, `replay:${anonId ?? "anon"}`);
  if (!rl.success) return NextResponse.json({ ok: false }, { status: 429 });

  const user = await getCurrentUser().catch(() => null);
  const { device } = parseUA(req.headers.get("user-agent") ?? "");
  const d = parsed.data;
  const path = d.path.split(/[?#]/)[0];
  const chunkBytes = JSON.stringify(d.ev).length + 100;
  const chunk: PageChunk = { path, t: 0, w: d.w, h: d.h, dur: d.dur, ev: d.ev as PageChunk["ev"] };
  const reachedCheckout = path.startsWith("/checkout");
  const purchased = path.startsWith("/checkout/success");

  try {
    const existing = await prisma.sessionRecording.findUnique({
      where: { id: d.id },
      select: { userId: true, anonId: true, pages: true, pageCount: true, sizeBytes: true, startedAt: true },
    });

    if (!existing) {
      await prisma.sessionRecording.create({
        data: {
          id: d.id,
          userId: user?.id ?? null,
          anonId: user ? null : anonId,
          device,
          pages: [chunk] as object[],
          pageCount: 1,
          duration: d.dur,
          clickCount: d.clicks,
          rageCount: d.rage,
          reachedCheckout,
          purchased,
          sizeBytes: chunkBytes,
        },
      });
    } else {
      // A session id can only be appended to by the browser that created it.
      const owner = existing.userId ?? existing.anonId;
      const caller = user?.id ?? anonId;
      if (owner && owner !== caller) return NextResponse.json({ ok: false }, { status: 403 });
      if (existing.pageCount >= MAX_PAGES || existing.sizeBytes + chunkBytes > MAX_BYTES) {
        return NextResponse.json({ ok: true }); // silently stop growing
      }
      const pages = (existing.pages as unknown as PageChunk[]) ?? [];
      chunk.t = Date.now() - existing.startedAt.getTime() - d.dur;
      await prisma.sessionRecording.update({
        where: { id: d.id },
        data: {
          pages: [...pages, chunk] as object[],
          pageCount: { increment: 1 },
          duration: { increment: d.dur },
          clickCount: { increment: d.clicks },
          rageCount: { increment: d.rage },
          sizeBytes: { increment: chunkBytes },
          endedAt: new Date(),
          ...(reachedCheckout ? { reachedCheckout: true } : {}),
          ...(purchased ? { purchased: true } : {}),
          ...(user?.id && !existing.userId ? { userId: user.id } : {}),
        },
      });
    }
  } catch (err) {
    console.error("[replay] append failed:", err);
  }
  return NextResponse.json({ ok: true });
}
