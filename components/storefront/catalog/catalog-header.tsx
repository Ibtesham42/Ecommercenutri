import { BlurImage } from "@/components/storefront/blur-image";
import { cn } from "@/lib/utils";

/**
 * Catalog page header. Three treatments:
 *  - plain (Shop, search, new arrivals): eyebrow, display title, description;
 *  - category with an image: editorial split — text left, contained image tile right;
 *  - category without an image: a quiet oat panel (no invented imagery).
 */
export function CatalogHeader({
  eyebrow,
  title,
  description,
  image,
  panel = false,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string | null;
  /** Category image — switches to the split layout. */
  image?: { src: string; alt: string } | null;
  /** Oat panel (category without an image). */
  panel?: boolean;
  /** Extra content under the description (search box, subcategory links…). */
  children?: React.ReactNode;
}) {
  const text = (
    <div className="min-w-0">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-2 font-heading sm:mt-3 text-title text-foreground [overflow-wrap:anywhere]">{title}</h1>
      {description && (
        <p className="mt-2 max-w-2xl text-[15px] sm:mt-3 leading-relaxed text-muted-foreground sm:text-base">{description}</p>
      )}
      {children}
    </div>
  );

  if (image) {
    return (
      // Mobile keeps the split too, with a small square tile, so products start early.
      <header className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-start gap-4 sm:grid-cols-[minmax(0,1fr)_8rem] md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-center md:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
        {text}
        <div className="relative aspect-square overflow-hidden rounded-lg bg-oat md:aspect-[4/3] md:rounded-xl">
          <BlurImage
            src={image.src}
            alt={image.alt}
            fill
            priority
            sizes="(max-width: 640px) 88px, (max-width: 768px) 128px, 24rem"
            className="object-cover"
          />
        </div>
      </header>
    );
  }

  return <header className={cn(panel && "rounded-xl bg-oat px-5 py-7 sm:px-8 sm:py-9 lg:px-10")}>{text}</header>;
}
