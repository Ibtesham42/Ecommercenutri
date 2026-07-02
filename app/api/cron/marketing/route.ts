import { NextResponse } from "next/server";
import { dispatchDueCampaigns } from "@/lib/marketing/deliver";
import { runAutomations } from "@/lib/marketing/automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Processes due scheduled campaigns. Wire this to Vercel Cron (see vercel.json):
 * Vercel sends `Authorization: Bearer <CRON_SECRET>`. When `CRON_SECRET` is unset
 * (local/dev), the route is open so it can be triggered manually.
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
