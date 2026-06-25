import { redirect } from "next/navigation";
import { getAdminUser, type AdminContext } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";

/**
 * Page-level guard for an admin section. Redirects (rather than throwing) so it
 * reads cleanly at the top of a server page component:
 *
 *   await guardSection("orders");
 *
 * Super admins always pass; sub-admins are sent back to the dashboard unless
 * they hold the permission. Server actions use `requirePermission` (which
 * throws) for the same checks.
 */
export async function guardSection(permission: Permission): Promise<AdminContext> {
  const admin = await getAdminUser();
  if (!admin) redirect("/login?callbackUrl=/admin");
  if (admin.role === "SUPER_ADMIN") return admin;
  if (!admin.permissions.includes(permission)) redirect("/admin");
  return admin;
}
