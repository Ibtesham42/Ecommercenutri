import { NextResponse } from "next/server";
import { runIntelligenceCycle } from "@/lib/intelligence/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Competitor Intelligence cron: refreshes stale competitor profiles, the
 * weekly/monthly market reports, the gap analysis and the daily ideas batch.
 * Heavily cached — reports are unique per period and ideas per IST day, so
 * repeated fires are near-free. Guarded by `CRON_SECRET` like /api/cron/social;
 * open when the secret is unset (dev).
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    const result = await runIntelligenceCycle(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/intelligence] failed:", err);
    return NextResponse.json({ ok: false, error: "Intelligence cron failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
