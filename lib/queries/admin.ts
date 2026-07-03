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

/** 14-day daily revenue/order series for the dashboard KPI sparklines. */
export async function getDashboardTrends(): Promise<{ revenue14d: number[]; orders14d: number[] }> {
  try {
    const DAY = 86_400_000;
    const now = new Date();
    const from = new Date(now.getTime() - 13 * DAY);
    from.setHours(0, 0, 0, 0);
    const orders = await prisma.order.findMany({
      where: { status: { notIn: ["CANCELLED", "RETURNED"] }, createdAt: { gte: from } },
      select: { total: true, createdAt: true },
      take: 10_000,
    });
    const revenue = new Map<string, number>();
    const count = new Map<string, number>();
    for (let i = 0; i < 14; i++) {
      const k = new Date(from.getTime() + i * DAY).toISOString().slice(0, 10);
      revenue.set(k, 0);
      count.set(k, 0);
    }
    for (const o of orders) {
      const k = o.createdAt.toISOString().slice(0, 10);
      if (revenue.has(k)) {
        revenue.set(k, (revenue.get(k) ?? 0) + o.total);
        count.set(k, (count.get(k) ?? 0) + 1);
      }
    }
    return { revenue14d: [...revenue.values()], orders14d: [...count.values()] };
  } catch (err) {
    console.error("[admin] dashboard trends failed:", err);
    return { revenue14d: [], orders14d: [] };
  }
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
