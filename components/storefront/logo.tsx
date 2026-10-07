import type { CSSProperties } from "react";
import Link from "next/link";
import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";
import { cldUrl } from "@/lib/cld";

/** Brand logo. Renders an uploaded image when `logoUrl` is set (via Appearance
 *  settings), otherwise the default wordmark. Size (desktop/mobile height and
 *  max width) is admin-configurable; falls back to the original 32px / 160px. */
export function Logo({
  className,
  logoUrl,
  name = "Nutriyet",
  height,
  mobileHeight,
  maxWidth,
  accentClassName = "text-primary",
  onDark = false,
  wordmarkClassName,
}: {
  className?: string;
  logoUrl?: string | null;
  name?: string;
  height?: number | null;
  mobileHeight?: number | null;
  maxWidth?: number | null;
  /** Accent color for the "yet" wordmark — override to `text-gold` on dark surfaces. */
  accentClassName?: string;
  /** Dark-chrome styling for the default wordmark's leaf chip. `true` = always
   *  on dark (footer); `"lg"` = dark only from lg up (the header is light cream
   *  below lg and deep green above it). */
  onDark?: boolean | "lg";
  /** Extra classes for the uploaded-logo wordmark span — used by the main
   *  header to hide it below `sm` instead of collapsing to a single
   *  illegible truncated letter when the icon row eats the available width. */
  wordmarkClassName?: string;
}) {
  const h = height ?? 32;
  const mh = mobileHeight ?? h;
  const mw = maxWidth ?? 160;
  const sizeVars = {
    "--logo-h": `${h}px`,
    "--logo-mh": `${mh}px`,
    "--logo-mw": `${mw}px`,
  } as CSSProperties;

  return (
    <Link
      href="/"
      aria-label={name}
      className={cn(
        "flex items-center gap-2 font-heading text-xl font-extrabold tracking-tight",
        className,
      )}
    >
      {logoUrl ? (
        <>
          <span className="inline-flex shrink-0 items-center justify-center">
            {/* Logo sits directly on the header/footer surface (no plate) so it
                blends with the menu background instead of showing a white card. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cldUrl(logoUrl, { h: Math.min(Math.max(h, mh) * 2, 256) })}
              alt={name}
              style={sizeVars}
              // Dark theme only: a soft light halo keeps a dark-colored logo
              // legible on dark chrome without adding a plate behind it.
              className="h-[var(--logo-mh)] w-auto max-w-[var(--logo-mw)] object-contain md:h-[var(--logo-h)] dark:[filter:drop-shadow(0_0_8px_oklch(0.98_0.01_120/0.3))]"
            />
          </span>
          {/* Wordmark alongside an uploaded logo image too — a custom mark
              alone reads as a bare icon (no brand name) in tight spots like
              the mobile nav drawer. Truncates under pressure alongside the
              image (parent gets `min-w-0 shrink` where space is contested). */}
          <span className={cn("truncate", wordmarkClassName)}>{name}</span>
        </>
      ) : (
        <>
          <span
            className={cn(
              "grid size-8 place-items-center rounded-xl shadow-elev-1",
              onDark === true && "bg-white text-primary",
              onDark === "lg" &&
                "bg-primary text-primary-foreground lg:bg-white lg:text-primary",
              !onDark && "bg-primary text-primary-foreground",
            )}
          >
            <Leaf className="size-5" />
          </span>
          <span>
            Nutri<span className={accentClassName}>yet</span>
          </span>
        </>
      )}
    </Link>
  );
}
