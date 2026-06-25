import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Orders that represent realized revenue (payment captured). */
const PAID_STATUSES: Prisma.EnumPaymentStatusFilter = {
  in: ["PAID", "REFUNDED"],
};

export type DashboardStats = {
  revenue: number; // paise, paid orders
  orderCount: number;
  paidOrderCount: number;
  pendingOrderCount: number;
  customerCount: number;
  productCount: number;
  lowStockCount: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    revenueAgg,
    orderCount,
    paidOrderCount,
    pendingOrderCount,
    customerCount,
    productCount,
    lowStockCount,
  ] = await Promise.all([
    prisma.order.aggregate({
      _sum: { total: true },
      where: { paymentStatus: "PAID" },
    }),
    prisma.order.count(),
    prisma.order.count({ where: { paymentStatus: PAID_STATUSES } }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { role: "USER" } }),
    prisma.product.count(),
    prisma.productVariant.count({ where: { isActive: true, stock: { lte: 10 } } }),
  ]);

  return {
    revenue: revenueAgg._sum.total ?? 0,
    orderCount,
    paidOrderCount,
    pendingOrderCount,
    customerCount,
    productCount,
    lowStockCount,
  };
}

export async function getRecentOrders(limit = 8) {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      orderNumber: true,
      total: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      _count: { select: { items: true } },
    },
  });
}

export type RecentOrder = Prisma.PromiseReturnType<typeof getRecentOrders>[number];

/** Low-stock variants (active), most urgent first. */
export async function getLowStockVariants(limit = 8) {
  return prisma.productVariant.findMany({
    where: { isActive: true, stock: { lte: 10 } },
    orderBy: { stock: "asc" },
    take: limit,
    select: {
      id: true,
      weightLabel: true,
      stock: true,
      product: { select: { name: true, slug: true } },
    },
  });
}

export type LowStockVariant = Prisma.PromiseReturnType<
  typeof getLowStockVariants
>[number];

/** Best-selling products by paid quantity. */
export async function getTopProducts(limit = 5) {
  const grouped = await prisma.orderItem.groupBy({
    by: ["productName"],
    where: { order: { paymentStatus: "PAID" } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });
  return grouped.map((g) => ({
    name: g.productName,
    unitsSold: g._sum.quantity ?? 0,
  }));
}
