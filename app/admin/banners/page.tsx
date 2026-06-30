import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { BannerManager, type BannerRow } from "@/components/admin/banner-manager";
import { prisma } from "@/lib/prisma";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Banners", robots: { index: false } };

export default async function AdminBannersPage() {
  await guardSection("appearance");

  const [banners, products, categories] = await Promise.all([
    prisma.banner.findMany({
      orderBy: [{ position: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows: BannerRow[] = banners.map((b) => ({
    id: b.id,
    mediaType: b.mediaType,
    videoUrl: b.videoUrl,
    title: b.title,
    subtitle: b.subtitle,
    description: b.description,
    desktopImage: b.desktopImage,
    mobileImage: b.mobileImage,
    desktopImageDark: b.desktopImageDark,
    mobileImageDark: b.mobileImageDark,
    ctaText: b.ctaText,
    ctaUrl: b.ctaUrl,
    productId: b.productId,
    categoryId: b.categoryId,
    position: b.position,
    priority: b.priority,
    isActive: b.isActive,
    startsAt: b.startsAt?.toISOString() ?? null,
    expiresAt: b.expiresAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Banners"
        description="Promotional banners shown across the storefront. Choose a placement and priority per banner."
      />
      <BannerManager
        banners={rows}
        products={products}
        categories={categories}
        cloudinaryReady={isConfigured.cloudinary()}
      />
    </div>
  );
}
