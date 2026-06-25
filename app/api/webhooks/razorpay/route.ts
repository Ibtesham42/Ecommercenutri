import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { markOrderPaid } from "@/lib/orders";

// Razorpay posts JSON; we must verify against the *raw* body.
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
  };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  // We only need to act on a successful capture; markOrderPaid is idempotent.
  if (event.event === "payment.captured" || event.event === "order.paid") {
    const entity = event.payload?.payment?.entity;
    const razorpayOrderId = entity?.order_id;
    if (razorpayOrderId) {
      const order = await prisma.order.findFirst({
        where: { razorpayOrderId },
        select: { id: true },
      });
      if (order) {
        try {
          await markOrderPaid(order.id, { paymentId: entity?.id ?? "" });
        } catch (err) {
          console.error("[webhook] markOrderPaid failed:", err);
          return NextResponse.json({ error: "processing failed" }, { status: 500 });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
