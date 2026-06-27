import { Prisma, type Invoice } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/queries/settings";
import type { InvoiceData } from "@/components/storefront/order-invoice";

/** Indian financial year (Apr–Mar) for a date, e.g. 2026-06 → "2025-26"? No:
 *  Apr 2026 → "2026-27", Feb 2026 → "2025-26". */
export function financialYear(d: Date): string {
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1; // April (month index 3)
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** Human invoice number, e.g. INV-2025-26-00042. `seq` is a DB autoincrement. */
export function formatInvoiceNumber(seq: number, issuedAt: Date): string {
  return `INV-${financialYear(issuedAt)}-${String(seq).padStart(5, "0")}`;
}

/**
 * Idempotent: returns the order's invoice, creating it on first call (also lazily
 * for legacy orders on first view). `seq` is assigned by the DB so the number is
 * collision-free; the `orderId @unique` constraint + P2002 catch handles a
 * concurrent double-create.
 */
export async function ensureInvoice(orderId: string): Promise<Invoice> {
  const existing = await prisma.invoice.findUnique({ where: { orderId } });
  if (existing) return existing;

  const store = await getStoreSettings();
  try {
    return await prisma.$transaction(async (tx) => {
      // Placeholder number (unique via orderId) replaced with the real one once
      // the DB has assigned `seq`; the temp value never commits outside the tx.
      const created = await tx.invoice.create({
        data: {
          orderId,
          invoiceNumber: `TMP-${orderId}`,
          sellerName: store.siteName,
          sellerAddress: store.address,
          sellerGstin: store.gstin,
          sellerEmail: store.supportEmail,
          sellerPhone: store.supportPhone,
        },
      });
      return tx.invoice.update({
        where: { id: created.id },
        data: { invoiceNumber: formatInvoiceNumber(created.seq, created.issuedAt) },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await prisma.invoice.findUnique({ where: { orderId } });
      if (again) return again;
    }
    throw e;
  }
}

type ShippingAddress = InvoiceData["billTo"];

/**
 * Assemble the full invoice payload (single source for the HTML invoice, the PDF
 * and the email). Ensures the invoice exists. Seller details come from the
 * immutable invoice snapshot; the logo is cosmetic (live store setting).
 */
export async function getInvoiceData(orderId: string): Promise<InvoiceData | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return null;

  const [invoice, store] = await Promise.all([
    ensureInvoice(orderId),
    getStoreSettings(),
  ]);

  return {
    orderNumber: order.orderNumber,
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt.toISOString(),
    placedAt: order.createdAt.toISOString(),
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    store: {
      name: invoice.sellerName,
      address: invoice.sellerAddress,
      gstin: invoice.sellerGstin,
      supportEmail: invoice.sellerEmail,
      supportPhone: invoice.sellerPhone,
      logo: store.logo,
    },
    billTo: order.shippingAddress as unknown as ShippingAddress,
    items: order.items.map((i) => ({
      productName: i.productName,
      variantLabel: i.variantLabel,
      quantity: i.quantity,
      price: i.price,
    })),
    subtotal: order.subtotal,
    discount: order.discount,
    couponCode: order.couponCode,
    tax: order.tax,
    shipping: order.shipping,
    shippingSaved: order.shippingSaved,
    codFee: order.codFee,
    total: order.total,
  };
}
