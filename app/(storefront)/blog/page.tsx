import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import { buildMetadata, blogListSchema, breadcrumbSchema, jsonLd } from "@/lib/seo";
import { getBlogPosts } from "@/lib/queries/blog";
import { EmptyState } from "@/components/storefront/empty-state";
import { JournalCard } from "@/components/storefront/journal-card";
import { CONTENT_PAGE_CLASS, PageHeader } from "@/components/storefront/page-header";

export const metadata: Metadata = buildMetadata({
  title: "Blog",
  description: "Nutrition tips, recipes and wellness stories from the Nutriyet team.",
  path: "/blog",
});

// DB-driven (CMS-managed) — render per request so new posts appear without a rebuild.
export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const posts = await getBlogPosts();

  return (
    <div className={CONTENT_PAGE_CLASS}>
      {posts.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd(
            blogListSchema(
              posts.map((p) => ({
                slug: p.slug,
                title: p.title,
                excerpt: p.excerpt,
                image: p.coverImage,
                datePublished: p.publishedAt.toISOString(),
                author: p.author,
              })),
            ),
          )}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
          ]),
        )}
      />
      <PageHeader
        crumbs={[{ name: "Home", href: "/" }, { name: "Journal" }]}
        eyebrow="Journal"
        title="The Nutriyet Journal"
        lede="Nutrition tips, simple recipes and wellness stories to help you eat clean and live strong."
      />

      {posts.length === 0 ? (
        <EmptyState
          className="mt-12"
          icon={Newspaper}
          title="No articles yet"
          description="We're cooking up fresh content. Check back soon!"
        />
      ) : (
        <>
          <div className="mt-10 sm:mt-12">
            <JournalCard post={posts[0]} feature headingLevel="h2" priority />
          </div>
          {posts.length > 1 && (
            <div className="mt-14 grid gap-x-8 gap-y-12 border-t border-border pt-12 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3 lg:pt-16">
              {posts.slice(1).map((post) => (
                <JournalCard key={post.slug} post={post} headingLevel="h2" />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
