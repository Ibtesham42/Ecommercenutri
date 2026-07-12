"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  requestReturnSchema,
  cancelReturnSchema,
  submitReturnInfoSchema,
} from "@/lib/validations/returns";
import { getReturnEligibility, generateReturnNumber, transitionReturnStatus } from "@/lib/returns";
import { canCustomerCancelReturn } from "@/lib/return-status";
import { returnStatusEmail } from "@/lib/emails";
import { sendEmail } from "@/lib/email";
import { notify } from "@/lib/notifications";

export type ReturnResult = { ok: true; returnNumber: string } | { ok: false; error: string };

function revalidateReturn(orderNumber: string | null, returnNumber?: string) {
  revalidatePath("/account/returns");
  if (returnNumber) revalidatePath(`/account/returns/${returnNumber}`);
  if (orderNumber) revalidatePath(`/account/orders/${orderNumber}`);
  revalidatePath("/admin/returns");
}

/** Customer requests a return/refund on a delivered, in-window order. */
export async function requestReturn(input: unknown): Promise<ReturnResult> {
  const user = await getCurrentUser();
  if (!user?.id) return { ok: false, error: "Please sign in." };

  const parsed = requestReturnSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }
  const { orderNumber, reason, description, media, items } = parsed.data;

  const order = await prisma.order.findFirst({
    where: { orderNumber, userId: user.id },
    select: { id: true },
  });
  if (!order) return { ok: false, error: "Order not found." };

  const elig = await getReturnEligibility(order.id);
  if (!elig.eligible) {
    return { ok: false, error: elig.reason ?? "This order isn't eligible for a return." };
  }

  // Re-validate the selected items + quantities server-side (never trust the client).
  const byId = new Map(elig.items.map((i) => [i.orderItemId, i]));
  const lines = [];
  let refundAmount = 0;
  for (const sel of items) {
    const e = byId.get(sel.orderItemId);
    if (!e) return { ok: false, error: "An item selected isn't eligible for return." };
    if (sel.quantity > e.returnableQty) {
      return { ok: false, error: `You can return at most ${e.returnableQty} × ${e.productName}.` };
    }
    refundAmount += e.unitPrice * sel.quantity;
    lines.push({
      orderItemId: e.orderItemId,
      quantity: sel.quantity,
      unitPrice: e.unitPrice,
      productName: e.productName,
      variantLabel: e.variantLabel,
      image: e.image,
    });
  }

  const returnNumber = generateReturnNumber();
  await prisma.returnRequest.create({
    data: {
      returnNumber,
      orderId: order.id,
      userId: user.id,
      reason,
      description: description || null,
      media,
      refundAmount,
      items: { create: lines },
      events: { create: { status: "REQUESTED", note: "Return requested", actor: "customer" } },
    },
  });

  await notify(user.id, {
    type: "RETURN_UPDATE",
    title: "Return request submitted",
    body: `We've received your return ${returnNumber}.`,
    link: `/account/returns/${returnNumber}`,
  });
  if (user.email) {
    const mail = returnStatusEmail({ returnNumber, orderNumber, status: "REQUESTED", name: user.name });
    if (mail) {
      try {
        await sendEmail({ to: user.email, ...mail });
      } catch (e) {
        console.error("[returns] request email failed:", e);
      }
    }
  }

  revalidateReturn(orderNumber, returnNumber);
  return { ok: true, returnNumber };
}

/** Customer withdraws a return while it's still open (before approval). */
export async function cancelReturn(input: unknown): Promise<ReturnResult> {
  const user = await getCurrentUser();
  if (!user?.id) return { ok: false, error: "Please sign in." };

  const parsed = cancelReturnSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "We couldn't identify that return. Please refresh the page and try again." };
  }

  const ret = await prisma.returnRequest.findFirst({
    where: { returnNumber: parsed.data.returnNumber, userId: user.id },
    select: { id: true, status: true },
  });
  if (!ret) return { ok: false, error: "Return not found." };
  if (!canCustomerCancelReturn(ret.status)) {
    return { ok: false, error: "This return can no longer be cancelled." };
  }

  const updated = await transitionReturnStatus(ret.id, "CANCELLED", {
    actor: "customer",
    note: "Cancelled by customer",
  });
  await notify(user.id, {
    type: "RETURN_UPDATE",
    title: "Return cancelled",
    body: `Return ${updated.returnNumber} was cancelled.`,
    link: `/account/returns/${updated.returnNumber}`,
  });

  revalidateReturn(updated.order.orderNumber, updated.returnNumber);
  return { ok: true, returnNumber: updated.returnNumber };
}

/** Customer replies to an admin "more info" request → back to UNDER_REVIEW. */
export async function submitReturnInfo(input: unknown): Promise<ReturnResult> {
  const user = await getCurrentUser();
  if (!user?.id) return { ok: false, error: "Please sign in." };

  const parsed = submitReturnInfoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const ret = await prisma.returnRequest.findFirst({
    where: { returnNumber: parsed.data.returnNumber, userId: user.id },
    select: { id: true, status: true, media: true },
  });
  if (!ret) return { ok: false, error: "Return not found." };
  if (ret.status !== "INFO_REQUESTED") {
    return { ok: false, error: "No additional information is being requested." };
  }

  const media = [...ret.media, ...parsed.data.media].slice(0, 12);
  const updated = await transitionReturnStatus(ret.id, "UNDER_REVIEW", {
    actor: "customer",
    note: `Customer reply: ${parsed.data.message}`,
    data: { media },
  });

  revalidateReturn(updated.order.orderNumber, updated.returnNumber);
  return { ok: true, returnNumber: updated.returnNumber };
}
