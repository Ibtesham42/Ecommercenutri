import type { Role } from "@prisma/client";

/**
 * Admin section keys used for role-based access control. A sub-admin (role
 * ADMIN) may access only the sections listed in `user.permissions`; a
 * SUPER_ADMIN has access to everything (including admin + store management).
 */
export const ADMIN_PERMISSIONS = [
  "products",
  "stories",
  "orders",
  "categories",
  "coupons",
  "inventory",
  "customers",
  "ai",
] as const;

export type Permission = (typeof ADMIN_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  products: "Products",
  stories: "Stories",
  orders: "Orders",
  categories: "Categories",
  coupons: "Coupons",
  inventory: "Inventory",
  customers: "Customers",
  ai: "AI settings",
};

/** Sensible default when creating a new sub-admin. */
export const DEFAULT_SUB_ADMIN_PERMISSIONS: Permission[] = ["products", "stories"];

export function isPermission(value: string): value is Permission {
  return (ADMIN_PERMISSIONS as readonly string[]).includes(value);
}

/** Keep only valid permission keys (defensive against stale/typo'd values). */
export function sanitizePermissions(values: string[]): Permission[] {
  return [...new Set(values.filter(isPermission))];
}

type AdminLike = { role: Role; permissions: string[] };

export function isSuperAdminRole(role: Role): boolean {
  return role === "SUPER_ADMIN";
}

export function isAdminRole(role: Role): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Does this admin have access to a given section? Super admins always do. */
export function hasPermission(user: AdminLike, permission: Permission): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  if (user.role !== "ADMIN") return false;
  return user.permissions.includes(permission);
}
