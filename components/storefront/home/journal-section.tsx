import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/storefront/section-heading";
import { getBlogPosts } from "@/lib/queries/blog";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Latest published Journal (blog) posts as editorial cards: large image, tag,
 * serif title, one-line excerpt. A single post renders as one wide feature
 * instead of a lonely card in a grid; no posts renders nothing.
 */
export async function JournalSection() {
  const posts = (await getBlogPosts()).slice(0, 3);
  if (posts.length === 0) return null;
  const feature = posts.length === 1;

  return (
    <section className="shop-section mx-auto w-full max-w-7xl px-4" data-heat="journal">
      <SectionHeading
        eyebrow="Journal"
        title="From our kitchen"
        subtitle="Notes on the foods we make and how to enjoy them."
        ctaLabel="All articles"
        ctaHref="/blog"
      />
      <div className={cn("grid gap-8", !feature && "sm:grid-cols-2 lg:grid-cols-3")}>
        {posts.map((post) => (
          <article key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className={cn("group grid gap-5", feature && "md:grid-cols-2 md:items-center md:gap-12")}
            >
              <div className={cn("relative overflow-hidden rounded-xl bg-oat", feature ? "aspect-[4/3]" : "aspect-[4/3]")}>
                {post.coverImage && (
                  <Image
                    src={post.coverImage}
                    alt=""
                    fill
                    sizes={feature ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 640px) 100vw, 33vw"}
                    className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
                  />
                )}
              </div>
              <div>
                <p className="eyebrow">
                  {post.tag || "Journal"}
                  {post.publishedAt && (
                    <span className="ml-2 font-normal tracking-normal normal-case text-muted-foreground">
                      {formatDate(post.publishedAt)}
                    </span>
                  )}
                </p>
                <h3
                  className={cn(
                    "mt-3 font-heading font-medium leading-snug text-foreground group-hover:text-primary",
                    feature ? "text-heading" : "text-subheading",
                  )}
                >
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="mt-3 line-clamp-2 text-[15px] leading-relaxed text-muted-foreground">{post.excerpt}</p>
                )}
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  Read article <ArrowRight className="size-4" />
                </span>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
