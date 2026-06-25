import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import {
  HeroSliderManager,
  type HeroSlideRow,
} from "@/components/admin/hero-slider-manager";
import { prisma } from "@/lib/prisma";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Hero Slider", robots: { index: false } };

export default async function AdminHeroPage() {
  await guardSection("appearance");

  const [slides, products, categories] = await Promise.all([
    prisma.heroSlide.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
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

  const rows: HeroSlideRow[] = slides.map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    description: s.description,
    desktopImage: s.desktopImage,
    mobileImage: s.mobileImage,
    ctaText: s.ctaText,
    ctaUrl: s.ctaUrl,
    productId: s.productId,
    categoryId: s.categoryId,
    overlay: s.overlay,
    buttonColor: s.buttonColor,
    textAlign: s.textAlign,
    isActive: s.isActive,
    startsAt: s.startsAt?.toISOString() ?? null,
    expiresAt: s.expiresAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Hero Slider"
        description="Manage the homepage slider shown right after Stories. Drag to reorder."
      />
      <HeroSliderManager
        slides={rows}
        products={products}
        categories={categories}
        cloudinaryReady={isConfigured.cloudinary()}
      />
    </div>
  );
}
