import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { BlogManager, type BlogRow } from "@/components/admin/blog-manager";
import { getAdminBlogPosts } from "@/lib/queries/blog";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Blog", robots: { index: false } };

export default async function AdminBlogPage() {
  await guardSection("appearance");
  const posts = await getAdminBlogPosts();

  const rows: BlogRow[] = posts.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    content: p.content,
    coverImage: p.coverImage,
    author: p.author,
    tag: p.tag,
    isPublished: p.isPublished,
    publishedAt: p.publishedAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader title="Blog" description={`${posts.length} post${posts.length === 1 ? "" : "s"}`} />
      <BlogManager posts={rows} cloudinaryReady={isConfigured.cloudinary()} />
    </div>
  );
}
