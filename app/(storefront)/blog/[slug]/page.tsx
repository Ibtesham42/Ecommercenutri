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
import { JournalCard } from "@/components/storefront/journal-card";
import { CONTENT_PAGE_CLASS, PageHeader, ReadingLayout } from "@/components/storefront/page-header";
import { ShareButtons } from "@/components/storefront/share-buttons";
import { NewsletterForm } from "@/components/storefront/newsletter-form";
import { TableOfContents } from "@/components/storefront/table-of-contents";
import { buildToc } from "@/lib/toc";

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

  const { html, headings } = buildToc(sanitizeRichText(post.content));
  // TOC only when the article is long enough to benefit — also earns Google
  // "jump to" links in results.
  const showToc = headings.length >= 3;

  return (
    <div className={CONTENT_PAGE_CLASS}>
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

      <article>
        <PageHeader
          crumbs={[{ name: "Home", href: "/" }, { name: "Journal", href: "/blog" }, { name: post.title }]}
          eyebrow={post.tag || "Journal"}
          title={post.title}
        >
          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-border py-3">
            <p className="text-sm text-muted-foreground">
              {post.author ? `${post.author} · ` : ""}
              {formatDate(post.publishedAt)} · {readingMinutes(post.content)} min read
            </p>
            <ShareButtons url={articleUrl} title={post.title} image={post.coverImage} />
          </div>
        </PageHeader>

        <ReadingLayout
          className="mt-8 sm:mt-10"
          rail={showToc ? <TableOfContents headings={headings} variant="rail" /> : undefined}
        >
          {post.coverImage && (
            <div className="mb-10 overflow-hidden rounded-xl bg-oat">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cldUrl(post.coverImage, { w: 1280, h: 720, crop: "fill" })}
                alt={post.title}
                className="aspect-[16/9] w-full object-cover"
              />
            </div>
          )}
          {showToc && <TableOfContents headings={headings} className="mb-10 lg:hidden" />}
          <div className="rich-content" dangerouslySetInnerHTML={{ __html: html }} />

          {/* Share again at the end — readers share after finishing, not before. */}
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <Link
              href="/blog"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> All articles
            </Link>
            <ShareButtons url={articleUrl} title={post.title} />
          </div>

          {/* Newsletter CTA — the reader just got value; offer more of it. */}
          <aside className="mt-12 rounded-xl bg-surface-deep p-6 text-surface-deep-foreground sm:p-8">
            <p className="eyebrow !text-gold">Newsletter</p>
            <h2 className="mt-2 font-heading text-subheading font-medium">Enjoyed this? Get more like it</h2>
            <p className="mt-1.5 text-sm text-surface-deep-foreground/75">
              Fresh nutrition tips, recipes and member-only offers — straight to your inbox. No spam,
              ever.
            </p>
            <div className="mt-5">
              <NewsletterForm source="blog" />
            </div>
          </aside>
        </ReadingLayout>
      </article>

      {related.length > 0 && (
        <section className="mt-20 border-t border-border pt-12 lg:mt-24 lg:pt-16" aria-labelledby="keep-reading">
          <p className="eyebrow">Journal</p>
          <h2 id="keep-reading" className="mt-2 font-heading text-heading font-medium">
            Keep reading
          </h2>
          <div className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <JournalCard key={r.slug} post={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
