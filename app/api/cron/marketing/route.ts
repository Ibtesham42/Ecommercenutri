import { NextResponse } from "next/server";
import { dispatchDueCampaigns } from "@/lib/marketing/deliver";
import { runAutomations } from "@/lib/marketing/automation";
import { guardCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Processes due scheduled campaigns. Wire this to Vercel Cron (see vercel.json):
 * Vercel sends `Authorization: Bearer <CRON_SECRET>`. Open in dev only — in
 * production a missing secret refuses the run (see lib/cron-auth.ts).
 */
async function handle(req: Request) {
  const denied = guardCron(req, "marketing");
  if (denied) return denied;
  try {
    const [processed, automation] = await Promise.all([
      dispatchDueCampaigns(),
      runAutomations(),
    ]);
    return NextResponse.json({
      ok: true,
      processed,
      automated: automation.delivered,
      automationRules: automation.rules,
    });
  } catch (err) {
    console.error("[cron/marketing] failed:", err);
    return NextResponse.json({ ok: false, error: "Dispatch failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
