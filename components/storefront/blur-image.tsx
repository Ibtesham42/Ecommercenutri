"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

/**
 * `next/image` with a subtle blur-up reveal: the image starts blurred and fades
 * in once decoded, killing the "pop-in". Honors `prefers-reduced-motion` (the
 * blur/scale transition is gated in globals.css `.img-reveal`). No CLS — the
 * caller still controls sizing via `fill`/width+height + `sizes`.
 */
export function BlurImage({ className, onLoad, alt, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Image
      {...props}
      alt={alt}
      data-loaded={loaded}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      className={cn("img-reveal", className)}
    />
  );
}
