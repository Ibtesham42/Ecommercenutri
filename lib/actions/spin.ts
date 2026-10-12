"use server";

import { cookies, headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, limiters } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/recommendations/events";
import {
  SPIN_COOKIE,
  SpinError,
  claimSpin,
  getLiveCampaign,
  spinWheel,
  toSpinView,
  type SpinView,
} from "@/lib/spin/service";

const ANON_COOKIE = "nut_anon";

export type SpinActionResult =
  | { ok: true; view: SpinView; signedIn: boolean; reassigned?: boolean }
  | { ok: false; error: string; code?: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

function friendly(err: unknown, fallback: string): SpinActionResult {
  if (err instanceof SpinError) return { ok: false, error: err.message, code: err.code };
  console.error("[spin]", err);
  return { ok: false, error: fallback };
}

/** Spin the wheel. Takes no input — nothing about the prize comes from the client. */
export async function spinAction(): Promise<SpinActionResult> {
  try {
    const user = await getCurrentUser();
    const jar = await cookies();
    const anonId = jar.get(ANON_COOKIE)?.value ?? null;
    const claimToken = jar.get(SPIN_COOKIE)?.value ?? null;

    await trackEvent({ type: "SPIN_START", userId: user?.id ?? null, anonId: user ? null : anonId, source: "spin-win" });

    // The engine calls this only right before creating a NEW anonymous spin —
    // after it has checked the cookie against the DB — so no cookie value
    // (valid, stale or forged) can skip the limit for a fresh spin.
    const allowAnonymousSpin = async () => {
      const ip = await clientIp();
      const [byIp, byAnon] = await Promise.all([
        checkRateLimit(limiters.spin, `ip:${ip}`),
        anonId ? checkRateLimit(limiters.spin, `anon:${anonId}`) : Promise.resolve({ success: true }),
      ]);
      return byIp.success && byAnon.success;
    };

    const outcome = await spinWheel({ userId: user?.id ?? null, anonId, claimToken, allowAnonymousSpin });
    if (outcome.claimToken) {
      const campaign = await getLiveCampaign();
      jar.set(SPIN_COOKIE, outcome.claimToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: (campaign?.claimWindowHours ?? 24) * 3600,
      });
    }
    if (outcome.created) {
      await trackEvent({
        type: "SPIN_WIN",
        userId: user?.id ?? null,
        anonId: user ? null : anonId,
        productId: outcome.spin.productId,
        source: `spin-${outcome.spin.percent}`,
      });
      if (user) await trackEvent({ type: "SPIN_CLAIM", userId: user.id, productId: outcome.spin.productId, source: "spin-win" });
    }
    return { ok: true, view: await toSpinView(outcome.spin), signedIn: Boolean(user) };
  } catch (err) {
    return friendly(err, "The wheel couldn't spin just now. Please try again.");
  }
}

/** Claim the anonymous win held in this browser's cookie for the signed-in account. */
export async function claimSpinAction(): Promise<SpinActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Please sign in to claim your offer.", code: "AUTH" };
    const jar = await cookies();
    const token = jar.get(SPIN_COOKIE)?.value;
    if (!token) return { ok: false, error: "We couldn't find a win to claim. Give the wheel a spin first.", code: "NOT_FOUND" };

    const rl = await checkRateLimit(limiters.spinClaim, `user:${user.id}`);
    if (!rl.success) return { ok: false, error: "Too many attempts. Please wait a few minutes." };

    const { spin, reassigned } = await claimSpin({ userId: user.id, claimToken: token });
    jar.delete(SPIN_COOKIE);
    await trackEvent({ type: "SPIN_AUTH", userId: user.id, source: "spin-win" });
    await trackEvent({ type: "SPIN_CLAIM", userId: user.id, productId: spin.productId, source: "spin-win" });
    return { ok: true, view: await toSpinView(spin), signedIn: true, reassigned };
  } catch (err) {
    if (err instanceof SpinError && ["EXPIRED", "NOT_FOUND", "ALREADY_CLAIMED"].includes(err.code)) {
      // Dead token — drop it so the page stops offering to claim it.
      try {
        (await cookies()).delete(SPIN_COOKIE);
      } catch {
        /* ignore */
      }
    }
    return friendly(err, "We couldn't claim your offer just now. Please try again.");
  }
}
