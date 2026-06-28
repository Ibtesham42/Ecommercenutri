import { Prisma, type ReturnStatus, type PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ReturnFilters = {
  status?: string;
  q?: string;
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd
  paymentMethod?: string;
};

/** Build the Prisma `where` for the admin returns list from URL filters. */
export function buildReturnWhere(f: ReturnFilters): Prisma.ReturnRequestWhereInput {
  const where: Prisma.ReturnRequestWhereInput = {};

  if (f.status && f.status !== "ALL") where.status = f.status as ReturnStatus;
  if (f.paymentMethod && f.paymentMethod !== "ALL") {
    where.order = { paymentMethod: f.paymentMethod as PaymentMethod };
  }
  if (f.from || f.to) {
    const range: Prisma.DateTimeFilter = {};
    if (f.from) range.gte = new Date(f.from);
    if (f.to) {
      const d = new Date(f.to);
      d.setHours(23, 59, 59, 999);
      range.lte = d;
    }
    where.createdAt = range;
  }
  const q = f.q?.trim();
  if (q) {
    where.OR = [
      { returnNumber: { contains: q, mode: "insensitive" } },
      { order: { orderNumber: { contains: q, mode: "insensitive" } } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ];
  }
  return where;
}

export async function getAdminReturns(f: ReturnFilters) {
  return prisma.returnRequest.findMany({
    where: buildReturnWhere(f),
    orderBy: { createdAt: "desc" },
    include: {
      order: { select: { orderNumber: true, paymentMethod: true } },
      user: { select: { name: true, email: true } },
      _count: { select: { items: true } },
    },
    take: 300,
  });
}

export type AdminReturnRow = Awaited<ReturnType<typeof getAdminReturns>>[number];

export async function getAdminReturn(returnNumber: string) {
  return prisma.returnRequest.findUnique({
    where: { returnNumber },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      creditNote: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          total: true,
          paymentMethod: true,
          paymentStatus: true,
          razorpayPaymentId: true,
        },
      },
      user: { select: { name: true, email: true, phone: true } },
    },
  });
}

export type AdminReturnDetail = NonNullable<Awaited<ReturnType<typeof getAdminReturn>>>;
