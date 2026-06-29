import "server-only";
import type { Prisma, SegmentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type Recipient = {
  userId: string;
  email: string | null;
  name: string | null;
  phone: string | null;
};

export type SegmentConfig = {
  productId?: string | null;
  categoryId?: string | null;
  userIds?: string[];
  inactiveDays?: number | null;
};

const DAY_MS = 86_400_000;

/** Build the Prisma `where` (scoped to active customer accounts) for a segment. */
function segmentWhere(type: SegmentType, config: SegmentConfig): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = { role: "USER", isActive: true };
  switch (type) {
    case "ALL_USERS":
      return base;
    case "CUSTOMERS":
      return { ...base, orders: { some: {} } };
    case "AFFILIATES":
      return { ...base, affiliate: { is: { status: "APPROVED" } } };
    case "PRODUCT_BUYERS":
      return config.productId
        ? { ...base, orders: { some: { items: { some: { productId: config.productId } } } } }
        : { ...base, id: "__none__" };
    case "CATEGORY_BUYERS":
      return config.categoryId
        ? { ...base, orders: { some: { items: { some: { product: { categoryId: config.categoryId } } } } } }
        : { ...base, id: "__none__" };
    case "WISHLIST":
      return {
        ...base,
        wishlist: config.productId ? { some: { productId: config.productId } } : { some: {} },
      };
    case "ABANDONED_CART":
      return { ...base, cart: { is: { items: { some: {} } } } };
    case "INACTIVE": {
      const days = config.inactiveDays && config.inactiveDays > 0 ? config.inactiveDays : 60;
      const cutoff = new Date(Date.now() - days * DAY_MS);
      return { ...base, orders: { none: { createdAt: { gte: cutoff } } } };
    }
    case "SELECTED":
      return { ...base, id: { in: config.userIds?.length ? config.userIds : ["__none__"] } };
    default:
      return { ...base, id: "__none__" };
  }
}

/** Resolve the recipient list (id + email + name) for a segment. */
export async function resolveAudience(
  type: SegmentType,
  config: SegmentConfig = {},
): Promise<Recipient[]> {
  const users = await prisma.user.findMany({
    where: segmentWhere(type, config),
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      addresses: { orderBy: { updatedAt: "desc" }, take: 1, select: { phone: true } },
    },
    take: 50_000,
  });
  return users.map((u) => ({
    userId: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone ?? u.addresses[0]?.phone ?? null,
  }));
}

/** Fast count for the audience preview (no row fetch). */
export async function countAudience(type: SegmentType, config: SegmentConfig = {}): Promise<number> {
  return prisma.user.count({ where: segmentWhere(type, config) });
}
