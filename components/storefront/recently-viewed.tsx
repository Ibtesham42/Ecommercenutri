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
      <h2 className="mb-5 text-xl font-bold">{title}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.slice(0, 5).map((p) => (
          <Link
            key={p.slug}
            href={`/products/${p.slug}`}
            className="group rounded-xl border p-2 transition hover:border-primary/40 hover:shadow-sm"
          >
            <div className="relative aspect-square overflow-hidden rounded-lg bg-accent/30">
              {p.image && (
                <Image
                  src={p.image}
                  alt={p.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 20vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
            </div>
            <p className="mt-2 line-clamp-1 text-sm font-medium">{p.name}</p>
            {p.price != null && (
              <p className="text-sm text-muted-foreground">{formatPrice(p.price)}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
