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
      ) : (
        <>
          <span
            className={cn(
              "grid size-8 place-items-center rounded-xl shadow-sm",
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
