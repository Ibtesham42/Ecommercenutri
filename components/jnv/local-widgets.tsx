"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Star } from "lucide-react";
import { getRecent, getFavorites, type JnvLocalItem } from "@/lib/jnv/local-store";

function Row({ item }: { item: JnvLocalItem }) {
  return (
    <Link
      href={item.href}
      className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
    >
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      {item.subject && (
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {item.subject}
        </span>
      )}
    </Link>
  );
}

/** "Continue Learning" + "Favorites" rails — read from this device's
 *  localStorage, since the portal has no student login to key off. */
export function JnvLocalWidgets() {
  const [recent, setRecent] = useState<JnvLocalItem[]>([]);
  const [favorites, setFavorites] = useState<JnvLocalItem[]>([]);

  useEffect(() => {
    setRecent(getRecent());
    setFavorites(getFavorites());
  }, []);

  if (recent.length === 0 && favorites.length === 0) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
      <div className="grid gap-6 sm:grid-cols-2">
        {recent.length > 0 && (
          <div>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <Clock className="size-4" /> Continue learning
            </h2>
            <div className="space-y-1.5">
              {recent.map((item) => (
                <Row key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
        {favorites.length > 0 && (
          <div>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <Star className="size-4" /> Favorites
            </h2>
            <div className="space-y-1.5">
              {favorites.slice(0, 8).map((item) => (
                <Row key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
