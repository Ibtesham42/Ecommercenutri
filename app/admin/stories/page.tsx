import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { StoryManager, type StoryRow } from "@/components/admin/story-manager";
import { prisma } from "@/lib/prisma";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Stories", robots: { index: false } };

export default async function AdminStoriesPage() {
  const [stories, products] = await Promise.all([
    prisma.story.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows: StoryRow[] = stories.map((s) => ({
    id: s.id,
    title: s.title,
    coverImage: s.coverImage,
    mediaUrl: s.mediaUrl,
    mediaType: s.mediaType,
    productId: s.productId,
    ctaText: s.ctaText,
    isPublished: s.isPublished,
    sortOrder: s.sortOrder,
    viewCount: s.viewCount,
    expiresAt: s.expiresAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <PageHeader title="Stories" description="Instagram-style storefront stories." />
      <StoryManager
        stories={rows}
        products={products}
        cloudinaryReady={isConfigured.cloudinary()}
      />
    </div>
  );
}
