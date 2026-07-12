import { NextResponse } from "next/server";
import { planDuePosts } from "@/lib/social/planner";
import { publishDuePosts } from "@/lib/social/publish";
import { syncRecentInsights } from "@/lib/social/insights";
import { guardCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * AI Marketing cron: plans the day's due posts from enabled campaigns, then
 * publishes any scheduled posts whose time has arrived. Driven by GitHub Actions
 * (every ~30 min) so it runs with the admin's machine off. Guarded by
 * `CRON_SECRET` (sent as `Authorization: Bearer <secret>`); open in dev only —
 * in production a missing secret refuses the run (see lib/cron-auth.ts).
 */
async function handle(req: Request) {
  const denied = guardCron(req, "social");
  if (denied) return denied;
  try {
    const now = new Date();
    const planned = await planDuePosts(now);
    const published = await publishDuePosts(now);
    // Refresh engagement for recently published posts (best-effort).
    const insights = await syncRecentInsights(now).catch(() => ({ synced: 0 }));
    return NextResponse.json({ ok: true, planned, published, insights });
  } catch (err) {
    console.error("[cron/social] failed:", err);
    return NextResponse.json({ ok: false, error: "Social cron failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
