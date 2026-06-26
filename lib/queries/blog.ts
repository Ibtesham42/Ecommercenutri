import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const listSelect = {
  slug: true,
  title: true,
  excerpt: true,
  coverImage: true,
  author: true,
  tag: true,
  publishedAt: true,
} satisfies Prisma.BlogPostSelect;

export type BlogListItem = Prisma.BlogPostGetPayload<{ select: typeof listSelect }>;
export type BlogPostFull = Prisma.BlogPostGetPayload<true>;

const publishedWhere: Prisma.BlogPostWhereInput = {
  isPublished: true,
  publishedAt: { lte: new Date() },
};

/** Published blog posts, newest first. Empty array on DB trouble. */
export async function getBlogPosts(): Promise<BlogListItem[]> {
  try {
    return await prisma.blogPost.findMany({
      where: publishedWhere,
      select: listSelect,
      orderBy: { publishedAt: "desc" },
    });
  } catch {
    return [];
  }
}

/** A single published post by slug (null if missing/unpublished). */
export async function getBlogPost(slug: string): Promise<BlogPostFull | null> {
  try {
    const post = await prisma.blogPost.findUnique({ where: { slug } });
    if (!post || !post.isPublished || post.publishedAt > new Date()) return null;
    return post;
  } catch {
    return null;
  }
}

/** Other recent posts to suggest at the end of an article. */
export async function getRelatedPosts(excludeSlug: string, take = 3): Promise<BlogListItem[]> {
  try {
    return await prisma.blogPost.findMany({
      where: { ...publishedWhere, slug: { not: excludeSlug } },
      select: listSelect,
      orderBy: { publishedAt: "desc" },
      take,
    });
  } catch {
    return [];
  }
}
