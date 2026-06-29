import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** Remove a Web Push subscription (on opt-out). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (body?.endpoint) {
    await prisma.pushSubscription
      .deleteMany({ where: { endpoint: body.endpoint, userId: user.id } })
      .catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
