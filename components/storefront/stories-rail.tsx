"use client";

import { useState } from "react";
import { cldUrl } from "@/lib/cld";
import { StoriesViewer, type StoryItem } from "@/components/storefront/stories-viewer";

export function StoriesRail({ stories }: { stories: StoryItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (stories.length === 0) return null;

  return (
    <>
      <div className="border-b bg-background/60">
        <div className="mx-auto flex w-full max-w-7xl gap-4 overflow-x-auto px-4 py-4">
          {stories.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setOpenIndex(i)}
              className="flex w-[72px] shrink-0 flex-col items-center gap-1.5"
            >
              <span className="rounded-full bg-gradient-to-tr from-primary via-emerald-400 to-amber-400 p-[2px]">
                <span className="block rounded-full bg-background p-[2px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cldUrl(s.coverImage, { w: 120, h: 120 })}
                    alt={s.title}
                    width={60}
                    height={60}
                    className="size-[60px] rounded-full object-cover"
                  />
                </span>
              </span>
              <span className="line-clamp-1 w-full text-center text-[11px] text-muted-foreground">
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
