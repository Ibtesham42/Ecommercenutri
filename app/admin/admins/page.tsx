import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { AdminManager, type AdminRow } from "@/components/admin/admin-manager";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Admins", robots: { index: false } };

export default async function AdminsPage() {
  // Only the main admin (SUPER_ADMIN) can manage admins.
  if (!(await isSuperAdmin())) redirect("/admin");

  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      contactEmail: true,
      address: true,
      image: true,
      role: true,
      permissions: true,
      isActive: true,
    },
  });

  const rows: AdminRow[] = users.map((u) => ({
    ...u,
    role: u.role as "ADMIN" | "SUPER_ADMIN",
  }));

  return (
    <div>
      <PageHeader
        title="Admins"
        description="Add and manage sub-admins and their access."
      />
      <AdminManager admins={rows} cloudinaryReady={isConfigured.cloudinary()} />
    </div>
  );
}
