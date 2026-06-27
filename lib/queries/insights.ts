import { prisma } from "@/lib/prisma";

/**
 * Admin "AI Insights" analytics, computed from real behavioral + order data
 * (UserEvent + OrderItem). All counts are scoped to a rolling window. Resilient
 * to an empty dataset (everything returns 0 / []), so the dashboard renders from
 * day one.
 */

export type NamedCount = { id: string; name: string; count: number };
export type FbtPair = { a: string; b: string; count: number };

export type Insights = {
  windowDays: number;
  productViews: number;
  recoClicks: number;
  searches: number;
  cartAdds: number;
  mostViewed: NamedCount[];
  mostPurchased: NamedCount[];
  mostCartAdded: NamedCount[];
  topSearches: { query: string; count: number }[];
  fbtPairs: FbtPair[];
  customersWithOrders: number;
  returningCustomers: number;
  repeatPurchaseRate: number; // 0..1
};

async function namesFor(productIds: string[]): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map();
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });
  return new Map(products.map((p) => [p.id, p.name]));
}

async function viewsByType(
  type: "PRODUCT_VIEW" | "CART_ADD",
  since: Date,
  limit: number,
): Promise<NamedCount[]> {
  const grouped = await prisma.userEvent.groupBy({
    by: ["productId"],
    where: { type, productId: { not: null }, createdAt: { gte: since } },
    _count: { productId: true },
    orderBy: { _count: { productId: "desc" } },
    take: limit,
  });
  const ids = grouped.map((g) => g.productId!).filter(Boolean);
  const names = await namesFor(ids);
  return grouped
    .filter((g) => g.productId)
    .map((g) => ({
      id: g.productId!,
      name: names.get(g.productId!) ?? "(removed product)",
      count: g._count.productId,
    }));
}

export async function getInsights(windowDays = 30): Promise<Insights> {
  const since = new Date(Date.now() - windowDays * 86_400_000);

  const [
    productViews,
    recoClicks,
    searches,
    cartAdds,
    mostViewed,
    mostCartAdded,
    purchasedGrouped,
    searchGrouped,
    paidOrdersByUser,
    recentOrders,
  ] = await Promise.all([
    prisma.userEvent.count({ where: { type: "PRODUCT_VIEW", createdAt: { gte: since } } }),
    prisma.userEvent.count({ where: { type: "RECO_CLICK", createdAt: { gte: since } } }),
    prisma.userEvent.count({ where: { type: "SEARCH", createdAt: { gte: since } } }),
    prisma.userEvent.count({ where: { type: "CART_ADD", createdAt: { gte: since } } }),
    viewsByType("PRODUCT_VIEW", since, 8),
    viewsByType("CART_ADD", since, 8),
    prisma.orderItem.groupBy({
      by: ["productId", "productName"],
      where: { order: { paymentStatus: "PAID", createdAt: { gte: since } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
    prisma.userEvent.groupBy({
      by: ["query"],
      where: { type: "SEARCH", query: { not: null }, createdAt: { gte: since } },
      _count: { query: true },
      orderBy: { _count: { query: "desc" } },
      take: 8,
    }),
    prisma.order.groupBy({
      by: ["userId"],
      where: { paymentStatus: "PAID" },
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: { paymentStatus: "PAID", createdAt: { gte: since } },
      select: { items: { select: { productName: true } } },
      orderBy: { createdAt: "desc" },
      take: 400,
    }),
  ]);

  const mostPurchased: NamedCount[] = purchasedGrouped.map((g) => ({
    id: g.productId ?? g.productName,
    name: g.productName,
    count: g._sum.quantity ?? 0,
  }));

  const topSearches = searchGrouped
    .filter((g) => g.query)
    .map((g) => ({ query: g.query!, count: g._count.query }));

  // Frequently-bought-together pairs (co-occurrence within an order), JS-aggregated.
  const pairCounts = new Map<string, FbtPair>();
  for (const order of recentOrders) {
    const names = [...new Set(order.items.map((i) => i.productName))].sort();
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = `${names[i]}|||${names[j]}`;
        const existing = pairCounts.get(key);
        if (existing) existing.count++;
        else pairCounts.set(key, { a: names[i], b: names[j], count: 1 });
      }
    }
  }
  const fbtPairs = [...pairCounts.values()]
    .filter((p) => p.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const customersWithOrders = paidOrdersByUser.length;
  const returningCustomers = paidOrdersByUser.filter((u) => u._count._all >= 2).length;
  const repeatPurchaseRate =
    customersWithOrders > 0 ? returningCustomers / customersWithOrders : 0;

  return {
    windowDays,
    productViews,
    recoClicks,
    searches,
    cartAdds,
    mostViewed,
    mostPurchased,
    mostCartAdded,
    topSearches,
    fbtPairs,
    customersWithOrders,
    returningCustomers,
    repeatPurchaseRate,
  };
}
