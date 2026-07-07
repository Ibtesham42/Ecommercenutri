import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper, ArrowRight } from "lucide-react";
import { buildMetadata, blogListSchema, breadcrumbSchema, jsonLd } from "@/lib/seo";
import { getBlogPosts } from "@/lib/queries/blog";
import { cldUrl } from "@/lib/cld";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { PageBreadcrumb } from "@/components/storefront/page-breadcrumb";

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
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
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
      <PageBreadcrumb items={[{ name: "Home", href: "/" }, { name: "Blog" }]} />

      <header className="mt-6 max-w-2xl">
        <h1 className="text-3xl font-bold sm:text-4xl">The Nutriyet Journal</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Nutrition tips, simple recipes and wellness stories to help you eat clean and live strong.
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed p-12 text-center">
          <Newspaper className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 font-medium">No articles yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;re cooking up fresh content. Check back soon!
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-accent/30">
                {post.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cldUrl(post.coverImage, { w: 640, h: 400, crop: "fill" })}
                    alt={post.title}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="grid size-full place-items-center text-muted-foreground/40">
                    <Newspaper className="size-10" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                {post.tag && (
                  <Badge variant="secondary" className="mb-2 w-fit">
                    {post.tag}
                  </Badge>
                )}
                <h2 className="font-semibold leading-snug group-hover:text-primary">{post.title}</h2>
                {post.excerpt && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>
                )}
                <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>
                    {post.author ? `${post.author} · ` : ""}
                    {formatDate(post.publishedAt)}
                  </span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
