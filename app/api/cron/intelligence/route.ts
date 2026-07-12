import { NextResponse } from "next/server";
import { runIntelligenceCycle } from "@/lib/intelligence/engine";
import { guardCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Competitor Intelligence cron: refreshes stale competitor profiles, the
 * weekly/monthly market reports, the gap analysis and the daily ideas batch.
 * Heavily cached — reports are unique per period and ideas per IST day, so
 * repeated fires are near-free. Guarded by `CRON_SECRET` like /api/cron/social;
 * open in dev only (see lib/cron-auth.ts).
 */
async function handle(req: Request) {
  const denied = guardCron(req, "intelligence");
  if (denied) return denied;
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
