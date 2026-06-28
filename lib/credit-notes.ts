import { Prisma, type CreditNote } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/queries/settings";
import { financialYear } from "@/lib/invoices";

/** Human credit-note number, e.g. CN-2025-26-00042. `seq` is a DB autoincrement. */
export function formatCreditNoteNumber(seq: number, issuedAt: Date): string {
  return `CN-${financialYear(issuedAt)}-${String(seq).padStart(5, "0")}`;
}

/**
 * Idempotent: returns the return's credit note, creating it on first call (at
 * refund completion). Mirrors `ensureInvoice` — `seq` is assigned by the DB so the
 * number is collision-free; the `returnRequestId @unique` + P2002 catch handles a
 * concurrent double-create. The seller + amount are snapshotted at issue time.
 */
export async function ensureCreditNote(returnRequestId: string): Promise<CreditNote> {
  const existing = await prisma.creditNote.findUnique({ where: { returnRequestId } });
  if (existing) return existing;

  const [ret, store] = await Promise.all([
    prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      select: { refundedAmount: true, refundAmount: true },
    }),
    getStoreSettings(),
  ]);
  const amount = ret?.refundedAmount || ret?.refundAmount || 0;

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.creditNote.create({
        data: {
          returnRequestId,
          number: `TMP-${returnRequestId}`,
          amount,
          sellerName: store.siteName,
          sellerAddress: store.address,
          sellerGstin: store.gstin,
          sellerEmail: store.supportEmail,
          sellerPhone: store.supportPhone,
        },
      });
      return tx.creditNote.update({
        where: { id: created.id },
        data: { number: formatCreditNoteNumber(created.seq, created.issuedAt) },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await prisma.creditNote.findUnique({ where: { returnRequestId } });
      if (again) return again;
    }
    throw e;
  }
}

export type CreditNoteData = {
  number: string;
  issuedAt: string;
  returnNumber: string;
  orderNumber: string;
  placedAt: string;
  reason: string;
  refundMethod: string | null;
  refundRef: string | null;
  customerName: string | null;
  store: {
    name: string;
    address: string | null;
    gstin: string | null;
    supportEmail: string | null;
    supportPhone: string | null;
    logo: string | null;
  };
  items: { productName: string; variantLabel: string; quantity: number; unitPrice: number }[];
  amount: number;
};

/** Assemble the full credit-note payload (HTML/PDF/email source of truth). */
export async function getCreditNoteData(returnId: string): Promise<CreditNoteData | null> {
  const ret = await prisma.returnRequest.findUnique({
    where: { id: returnId },
    include: {
      items: true,
      order: { select: { orderNumber: true, createdAt: true } },
      user: { select: { name: true } },
    },
  });
  if (!ret) return null;

  const [cn, store] = await Promise.all([ensureCreditNote(returnId), getStoreSettings()]);
  return {
    number: cn.number,
    issuedAt: cn.issuedAt.toISOString(),
    returnNumber: ret.returnNumber,
    orderNumber: ret.order.orderNumber,
    placedAt: ret.order.createdAt.toISOString(),
    reason: ret.reason,
    refundMethod: ret.refundMethod,
    refundRef: ret.refundRef,
    customerName: ret.user.name,
    store: {
      name: cn.sellerName,
      address: cn.sellerAddress,
      gstin: cn.sellerGstin,
      supportEmail: cn.sellerEmail,
      supportPhone: cn.sellerPhone,
      logo: store.logo,
    },
    items: ret.items.map((i) => ({
      productName: i.productName,
      variantLabel: i.variantLabel,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    amount: cn.amount || ret.refundedAmount,
  };
}
