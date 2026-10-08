import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BlogListItem } from "@/lib/queries/blog";

/**
 * Editorial Journal card: image, tag + date eyebrow, serif title, short
 * excerpt. `feature` lays it out as a wide image|text split for a lead post.
 */
export function JournalCard({
  post,
  feature = false,
  headingLevel = "h3",
  priority = false,
}: {
  post: BlogListItem;
  feature?: boolean;
  headingLevel?: "h2" | "h3";
  priority?: boolean;
}) {
  const Heading = headingLevel;
  return (
    <article>
      <Link
        href={`/blog/${post.slug}`}
        className={cn("group grid gap-5", feature && "md:grid-cols-2 md:items-center md:gap-12")}
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-oat">
          {post.coverImage && (
            <Image
              src={post.coverImage}
              alt=""
              fill
              priority={priority}
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
          <Heading
            className={cn(
              "mt-3 font-heading font-medium leading-snug text-foreground group-hover:text-primary",
              feature ? "text-heading" : "text-subheading",
            )}
          >
            {post.title}
          </Heading>
          {post.excerpt && (
            <p className={cn("mt-3 text-[15px] leading-relaxed text-muted-foreground", feature ? "line-clamp-3" : "line-clamp-2")}>
              {post.excerpt}
            </p>
          )}
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            Read article <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </span>
        </div>
      </Link>
    </article>
  );
}
