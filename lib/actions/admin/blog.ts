"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { sanitizeRichText } from "@/lib/sanitize";
import { blogPostSchema } from "@/lib/validations/admin";
import type { AdminResult, BulkOutcome } from "@/lib/actions/admin/types";

function revalidate(slug?: string) {
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  if (slug) revalidatePath(`/blog/${slug}`);
  revalidatePath("/sitemap.xml");
}

/** Create or update a blog post. Body HTML is sanitized before storage. */
export async function saveBlogPost(input: unknown): Promise<AdminResult<{ id: string }>> {
  await requirePermission("appearance");
  const parsed = blogPostSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid post." };
  const d = parsed.data;

  // Enforce slug uniqueness (excluding the post being edited).
  const clash = await prisma.blogPost.findUnique({ where: { slug: d.slug }, select: { id: true } });
  if (clash && clash.id !== d.id) return { ok: false, error: "That slug is already in use." };

  const data = {
    slug: d.slug,
    title: d.title,
    excerpt: d.excerpt || null,
    content: sanitizeRichText(d.content),
    coverImage: d.coverImage || null,
    author: d.author || null,
    tag: d.tag || null,
    isPublished: d.isPublished,
    ...(d.publishedAt ? { publishedAt: d.publishedAt } : {}),
  };

  try {
    let id = d.id;
    if (id) {
      await prisma.blogPost.update({ where: { id }, data });
    } else {
      const created = await prisma.blogPost.create({ data });
      id = created.id;
    }
    revalidate(d.slug);
    return { ok: true, data: { id } };
  } catch (err) {
    console.error("[admin] saveBlogPost failed:", err);
    return { ok: false, error: "Could not save the post." };
  }
}

export async function deleteBlogPost(id: string): Promise<AdminResult> {
  await requirePermission("appearance");
  const post = await prisma.blogPost.findUnique({ where: { id }, select: { slug: true } });
  await prisma.blogPost.delete({ where: { id } });
  revalidate(post?.slug);
  return { ok: true };
}

const BLOG_BULK_ACTIONS = ["publish", "unpublish", "delete"] as const;
type BlogBulkAction = (typeof BLOG_BULK_ACTIONS)[number];

export async function bulkBlogAction(
  ids: string[],
  action: BlogBulkAction,
): Promise<AdminResult<BulkOutcome>> {
  await requirePermission("appearance");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Nothing selected." };
  if (!BLOG_BULK_ACTIONS.includes(action)) return { ok: false, error: "Unknown action." };
  try {
    const res =
      action === "delete"
        ? await prisma.blogPost.deleteMany({ where: { id: { in: ids } } })
        : await prisma.blogPost.updateMany({
            where: { id: { in: ids } },
            data: { isPublished: action === "publish" },
          });
    revalidate();
    return { ok: true, data: { done: res.count, skipped: ids.length - res.count } };
  } catch (err) {
    console.error("[admin] bulkBlogAction failed:", err);
    return { ok: false, error: "Bulk action failed." };
  }
}
