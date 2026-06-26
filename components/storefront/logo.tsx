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
}: {
  className?: string;
  logoUrl?: string | null;
  name?: string;
  height?: number | null;
  mobileHeight?: number | null;
  maxWidth?: number | null;
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
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={cldUrl(logoUrl, { h: Math.min(Math.max(h, mh) * 2, 256) })}
          alt={name}
          style={sizeVars}
          className="h-[var(--logo-mh)] w-auto max-w-[var(--logo-mw)] object-contain md:h-[var(--logo-h)]"
        />
      ) : (
        <>
          <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Leaf className="size-5" />
          </span>
          <span>
            Nutri<span className="text-primary">yet</span>
          </span>
        </>
      )}
    </Link>
  );
}
