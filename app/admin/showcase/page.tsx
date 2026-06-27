import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { ShowcaseManager, type ShowcaseRow } from "@/components/admin/showcase-manager";
import { prisma } from "@/lib/prisma";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "3D Showcase", robots: { index: false } };

export default async function AdminShowcasePage() {
  await guardSection("appearance");

  const [items, products, setting] = await Promise.all([
    prisma.showcaseItem.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.storeSetting.findUnique({
      where: { id: "singleton" },
      select: { showcase3dEnabled: true },
    }),
  ]);

  const rows: ShowcaseRow[] = items.map((s) => ({
    id: s.id,
    title: s.title,
    tagline: s.tagline,
    image: s.image,
    productId: s.productId,
    ctaText: s.ctaText,
    ctaUrl: s.ctaUrl,
    animation: s.animation,
    background: s.background,
    rotationSpeed: s.rotationSpeed,
    floatIntensity: s.floatIntensity,
    zoom: s.zoom,
    isActive: s.isActive,
  }));

  return (
    <div>
      <PageHeader
        title="3D Showcase"
        description="A premium 3D hero product showcase at the top of the homepage. Add items, pick an animation style, and drag to reorder. No code needed."
      />
      <ShowcaseManager
        items={rows}
        products={products}
        enabled={setting?.showcase3dEnabled ?? false}
        cloudinaryReady={isConfigured.cloudinary()}
      />
    </div>
  );
}
