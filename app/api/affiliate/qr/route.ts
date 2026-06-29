import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { referralUrl } from "@/lib/affiliate/codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PNG QR code of the current affiliate's referral URL. `?download=1` → attachment. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) return new Response("Unauthorized", { status: 401 });

  const aff = await prisma.affiliate.findUnique({
    where: { userId: user.id },
    select: { code: true, status: true },
  });
  if (!aff || aff.status !== "APPROVED") return new Response("Not found", { status: 404 });

  const png = await QRCode.toBuffer(referralUrl(aff.code), {
    width: 600,
    margin: 2,
    color: { dark: "#13241c", light: "#ffffff" },
  });

  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="nutriyet-${aff.code}-qr.png"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
