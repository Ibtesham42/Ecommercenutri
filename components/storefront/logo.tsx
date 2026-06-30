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
  /** On dark chrome (deep-green header/footer) an uploaded logo gets a subtle
   *  light chip so any colored/transparent logo stays legible and crisp. */
  onDark?: boolean;
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
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center",
            // Adaptive contrast plate on dark chrome: a clean light card so any
            // dark/colored/transparent logo reads crisply, with breathing room.
            onDark &&
              "rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-black/5 sm:p-2",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cldUrl(logoUrl, { h: Math.min(Math.max(h, mh) * 2, 256) })}
            alt={name}
            style={sizeVars}
            className="h-[var(--logo-mh)] w-auto max-w-[var(--logo-mw)] object-contain md:h-[var(--logo-h)]"
          />
        </span>
      ) : (
        <>
          <span
            className={cn(
              "grid size-8 place-items-center rounded-xl shadow-sm",
              onDark ? "bg-white text-primary" : "bg-primary text-primary-foreground",
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
