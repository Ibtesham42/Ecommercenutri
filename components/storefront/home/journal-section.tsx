import { SectionHeading } from "@/components/storefront/section-heading";
import { JournalCard } from "@/components/storefront/journal-card";
import { getBlogPosts } from "@/lib/queries/blog";
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
          <JournalCard key={post.slug} post={post} feature={feature} />
        ))}
      </div>
    </section>
  );
}
