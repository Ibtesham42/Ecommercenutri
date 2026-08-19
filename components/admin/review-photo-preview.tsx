"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cldUrl } from "@/lib/cld";

/** Compact "has photos" indicator + click-to-preview dialog for the admin
 *  review table. Read-only — moderation stays on the existing approve/hide/
 *  delete controls, this just lets an admin see what was uploaded. */
export function ReviewPhotoPreview({ images, customer }: { images: string[]; customer: string }) {
  const [open, setOpen] = useState(false);
  if (images.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        aria-label={`Preview ${images.length} photo${images.length === 1 ? "" : "s"} from ${customer}'s review`}
      >
        <ImageIcon className="size-3.5" />
        {images.length} photo{images.length === 1 ? "" : "s"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Photos from {customer}&apos;s review</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {images.map((url, i) => (
              <div key={url} className="relative aspect-square overflow-hidden rounded-lg border bg-accent/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cldUrl(url, { w: 300, h: 300, crop: "fill" })}
                  alt={`Photo ${i + 1} from ${customer}'s review`}
                  className="size-full object-cover"
                />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
