"use client";

import { useState } from "react";
import { BlurImage } from "@/components/storefront/blur-image";
import { ReviewPhotoLightbox } from "@/components/storefront/review-photo-lightbox";
import { cldUrl } from "@/lib/cld";

/** Responsive, touch-friendly thumbnail grid for one review's photos — tap a
 *  thumbnail to open the full-screen lightbox at that photo. */
export function ReviewPhotoGallery({ images, reviewerName }: { images: string[]; reviewerName: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (images.length === 0) return null;

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {images.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => {
              setIndex(i);
              setOpen(true);
            }}
            aria-label={`View photo ${i + 1} of ${images.length} from ${reviewerName}'s review`}
            className="relative size-16 shrink-0 overflow-hidden rounded-lg border transition hover:opacity-90 sm:size-20"
          >
            <BlurImage
              src={cldUrl(url, { w: 200, h: 200, crop: "fill" })}
              alt={`Photo ${i + 1} from ${reviewerName}'s review`}
              fill
              sizes="80px"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      <ReviewPhotoLightbox
        open={open}
        onOpenChange={setOpen}
        images={images}
        initialIndex={index}
        title={`Photos from ${reviewerName}'s review`}
      />
    </>
  );
}
