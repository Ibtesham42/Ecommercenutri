"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import { cldUrl } from "@/lib/cld";
import { recordStoryView } from "@/lib/actions/stories";

export type StoryItem = {
  id: string;
  title: string;
  coverImage: string;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
  ctaText: string | null;
  product: { slug: string; name: string } | null;
};

const IMAGE_DURATION = 5000; // ms per image story

export function StoriesViewer({
  stories,
  startIndex,
  onClose,
}: {
  stories: StoryItem[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewed = useRef<Set<string>>(new Set());

  const current = stories[index];

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i >= stories.length - 1) {
        onClose();
        return i;
      }
      return i + 1;
    });
  }, [stories.length, onClose]);

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Record a view once per story.
  useEffect(() => {
    if (current && !viewed.current.has(current.id)) {
      viewed.current.add(current.id);
      void recordStoryView(current.id);
    }
  }, [current]);

  // Auto-advance images via rAF (videos advance on `ended`).
  useEffect(() => {
    setProgress(0);
    if (!current || current.mediaType === "VIDEO") return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      if (!pausedRef.current) {
        acc += dt;
        const p = Math.min(1, acc / IMAGE_DURATION);
        setProgress(p);
        if (p >= 1) {
          goNext();
          return;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [current, goNext]);

  // Keyboard controls + scroll lock.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, goNext, goPrev]);

  // Pause when the tab is hidden.
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Keep the <video> element in sync with pause state.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else void v.play().catch(() => {});
  }, [paused, current]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Stories"
    >
      <div className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-black sm:h-[92vh] sm:rounded-2xl">
        {/* Progress bars */}
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 p-3">
          {stories.map((s, i) => (
            <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white"
                style={{
                  width:
                    i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
                  transition: i === index ? "width 80ms linear" : undefined,
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute inset-x-0 top-0 z-20 mt-4 flex items-center gap-3 p-3">
          <span className="size-8 overflow-hidden rounded-full ring-2 ring-white/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cldUrl(current.coverImage, { w: 64, h: 64 })} alt="" className="size-full object-cover" />
          </span>
          <span className="line-clamp-1 flex-1 text-sm font-medium text-white drop-shadow">
            {current.title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full bg-black/30 text-white hover:bg-black/50"
            aria-label="Close stories"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Media */}
        <div className="relative flex flex-1 items-center justify-center">
          {current.mediaType === "VIDEO" ? (
            <video
              ref={videoRef}
              src={current.mediaUrl}
              autoPlay
              muted
              playsInline
              onEnded={goNext}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration) setProgress(v.currentTime / v.duration);
              }}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={cldUrl(current.mediaUrl, { w: 800 })}
              alt={current.title}
              className="max-h-full max-w-full object-contain"
            />
          )}

          {/* Tap zones */}
          <button
            type="button"
            aria-label="Previous"
            onClick={goPrev}
            className="absolute inset-y-0 left-0 z-10 w-1/3"
          />
          <button
            type="button"
            aria-label="Next"
            onClick={goNext}
            className="absolute inset-y-0 right-0 z-10 w-2/3"
          />
        </div>

        {/* CTA */}
        {current.product && (
          <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center p-5">
            <Link
              href={`/products/${current.product.slug}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-lg transition hover:bg-white/90"
            >
              {current.ctaText ?? "Shop now"} <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
