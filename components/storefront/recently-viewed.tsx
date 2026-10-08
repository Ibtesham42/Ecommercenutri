"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";

type RecentItem = {
  slug: string;
  name: string;
  image: string | null;
  price: number | null; // effective price, paise
};

const KEY = "nutriyet-recent";
const MAX = 10;

function read(): RecentItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch {
    return [];
  }
}

/** Records the current product into the recently-viewed list (newest first). */
export function RecentlyViewedTracker({ item }: { item: RecentItem }) {
  useEffect(() => {
    const list = read().filter((i) => i.slug !== item.slug);
    list.unshift(item);
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch {
      /* ignore quota / private mode */
    }
  }, [item]);
  return null;
}

/** Displays recently-viewed products, excluding the current one. */
export function RecentlyViewed({
  excludeSlug,
  title = "Recently viewed",
}: {
  excludeSlug?: string;
  title?: string;
}) {
  const [items, setItems] = useState<RecentItem[] | null>(null);

  useEffect(() => {
    setItems(read().filter((i) => i.slug !== excludeSlug));
  }, [excludeSlug]);

  if (!items || items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-6 font-heading text-subheading text-foreground">{title}</h2>
      {/* Compact variant of the product card language (localStorage only holds
          name/image/price, so there's no rating, size or add-to-cart here). */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-5">
        {items.slice(0, 5).map((p) => (
          <Link key={p.slug} href={`/products/${p.slug}`} className="pcard group rounded-xl">
            <div className="pcard-media relative aspect-square overflow-hidden rounded-xl bg-(--pcard-media)">
              {p.image && (
                <Image
                  src={p.image}
                  alt={p.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 20vw"
                  className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
                />
              )}
            </div>
            <p className="mt-2.5 line-clamp-2 font-heading text-[15px] font-medium leading-snug group-hover:text-primary">
              {p.name}
            </p>
            {p.price != null && (
              <p className="mt-1 text-sm font-semibold tabular-nums">{formatPrice(p.price)}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
