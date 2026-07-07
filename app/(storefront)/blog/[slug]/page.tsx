import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buildMetadata, breadcrumbSchema, jsonLd } from "@/lib/seo";
import { sanitizeRichText } from "@/lib/sanitize";
import { siteConfig } from "@/config/site";
import { getBlogPost, getRelatedPosts } from "@/lib/queries/blog";
import { cldUrl } from "@/lib/cld";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { PageBreadcrumb } from "@/components/storefront/page-breadcrumb";
import { ShareButtons } from "@/components/storefront/share-buttons";
import { NewsletterForm } from "@/components/storefront/newsletter-form";

/** ~220 wpm over the visible text — floor of 1 so short notes still read "1 min". */
function readingMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return buildMetadata({ title: "Article not found", noindex: true });
  return buildMetadata({
    title: post.title,
    description: post.excerpt ?? undefined,
    path: `/blog/${post.slug}`,
    image: post.coverImage ?? undefined,
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const related = await getRelatedPosts(post.slug);

  const articleUrl = new URL(`/blog/${post.slug}`, siteConfig.url).toString();
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.coverImage ? new URL(post.coverImage, siteConfig.url).toString() : undefined,
    datePublished: post.publishedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
    url: articleUrl,
    author: { "@type": "Organization", name: post.author ?? siteConfig.name, url: siteConfig.url },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: {
        "@type": "ImageObject",
        url: new URL(siteConfig.ogImage, siteConfig.url).toString(),
      },
    },
  };

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(articleSchema)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
        )}
      />

      <PageBreadcrumb
        items={[{ name: "Home", href: "/" }, { name: "Blog", href: "/blog" }, { name: post.title }]}
      />

      <header className="mt-6">
        {post.tag && <Badge variant="secondary">{post.tag}</Badge>}
        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{post.title}</h1>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {post.author ? `${post.author} · ` : ""}
            {formatDate(post.publishedAt)} · {readingMinutes(post.content)} min read
          </p>
          <ShareButtons url={articleUrl} title={post.title} image={post.coverImage} />
        </div>
      </header>

      {post.coverImage && (
        <div className="mt-6 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cldUrl(post.coverImage, { w: 1280, h: 720, crop: "fill" })}
            alt={post.title}
            className="aspect-[16/9] w-full object-cover"
          />
        </div>
      )}

      <div
        className="rich-content mt-8"
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(post.content) }}
      />

      {/* Share again at the end — readers share after finishing, not before. */}
      <div className="mt-10 flex items-center justify-between border-t pt-6">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to all articles
        </Link>
        <ShareButtons url={articleUrl} title={post.title} />
      </div>

      {/* Newsletter CTA — the reader just got value; offer more of it. */}
      <div className="surface-rich mt-12 rounded-2xl p-6 text-surface-deep-foreground sm:p-8">
        <h2 className="font-heading text-xl font-semibold">Enjoyed this? Get more like it</h2>
        <p className="mt-1.5 text-sm text-surface-deep-foreground/70">
          Fresh nutrition tips, recipes and member-only offers — straight to your
          inbox. No spam, ever.
        </p>
        <div className="mt-4">
          <NewsletterForm source="blog" />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold">Keep reading</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/blog/${r.slug}`}
                className="group rounded-xl border p-4 transition-shadow hover:shadow-md"
              >
                <p className="font-medium leading-snug group-hover:text-primary">{r.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(r.publishedAt)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
