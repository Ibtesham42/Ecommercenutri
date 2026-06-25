"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function ProductGallery({
  images,
  name,
}: {
  images: { url: string; alt: string | null }[];
  name: string;
}) {
  const [active, setActive] = useState(0);
  const main = images[active] ?? images[0];

  return (
    <div className="space-y-3">
      <div className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-2xl border bg-accent/20">
        {main && (
          <Image
            src={main.url}
            alt={main.alt ?? name}
            fill
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.6]"
            priority
          />
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-lg border transition",
                i === active
                  ? "ring-2 ring-primary ring-offset-1"
                  : "hover:border-primary/40",
              )}
            >
              <Image
                src={img.url}
                alt={img.alt ?? name}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
