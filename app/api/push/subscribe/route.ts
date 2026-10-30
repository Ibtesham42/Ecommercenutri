import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// The marketing sender POSTs to the stored endpoint, so only accept real browser
// push services (Chrome/Edge/Firefox/Safari) — never an arbitrary or internal URL.
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  ".push.apple.com",
  ".notify.windows.com",
];

function isPushEndpoint(endpoint: string): boolean {
  if (endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    if (u.protocol !== "https:" || u.port || u.username || u.password) return false;
    return PUSH_HOSTS.some((h) => (h.startsWith(".") ? u.hostname.endsWith(h) : u.hostname === h));
  } catch {
    return false;
  }
}

/** Save (or refresh) the current user's Web Push subscription. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  let sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    sub = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  if (
    typeof sub?.endpoint !== "string" ||
    !isPushEndpoint(sub.endpoint) ||
    typeof sub.keys?.p256dh !== "string" ||
    typeof sub.keys?.auth !== "string" ||
    sub.keys.p256dh.length > 200 ||
    sub.keys.auth.length > 100
  ) {
    return NextResponse.json({ ok: false, error: "Invalid subscription" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    create: { userId: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
  return NextResponse.json({ ok: true });
}
