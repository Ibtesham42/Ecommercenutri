"use client";

import { useState } from "react";
import { cldUrl } from "@/lib/cld";
import { StoriesViewer, type StoryItem } from "@/components/storefront/stories-viewer";

export function StoriesRail({ stories }: { stories: StoryItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (stories.length === 0) return null;

  return (
    <>
      <div className="border-b bg-background/60" data-heat="stories">
        <div className="mx-auto flex w-full max-w-7xl snap-x gap-5 overflow-x-auto px-4 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {stories.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group flex w-[76px] shrink-0 snap-start flex-col items-center gap-1.5"
            >
              <span className="rounded-full bg-gradient-to-tr from-primary via-emerald-400 to-gold p-[2.5px] transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
                <span className="block rounded-full bg-background p-[2.5px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cldUrl(s.coverImage, { w: 132, h: 132 })}
                    alt={s.title}
                    width={64}
                    height={64}
                    className="size-16 rounded-full object-cover"
                  />
                </span>
              </span>
              <span className="line-clamp-1 w-full text-center text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                {s.title.replace("Spotlight: ", "")}
              </span>
            </button>
          ))}
        </div>
      </div>

      {openIndex !== null && (
        <StoriesViewer
          stories={stories}
          startIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
