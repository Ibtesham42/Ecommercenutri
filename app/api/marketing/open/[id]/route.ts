import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 1×1 transparent GIF.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

/** Email open-tracking pixel: records an OPEN event + increments the campaign count. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = new URL(req.url).searchParams.get("u");
  try {
    await prisma.$transaction([
      prisma.campaignEvent.create({
        data: { campaignId: id, userId: userId || null, type: "OPEN", channel: "EMAIL" },
      }),
      prisma.campaign.update({ where: { id }, data: { openCount: { increment: 1 } } }),
    ]);
  } catch {
    // Unknown campaign / DB blip — still return the pixel so the email renders.
  }
  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Content-Length": String(PIXEL.length),
    },
  });
}
