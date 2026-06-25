import Link from "next/link";
import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";
import { cldUrl } from "@/lib/cld";

/** Brand logo. Renders an uploaded image when `logoUrl` is set (via Appearance
 *  settings), otherwise the default wordmark. */
export function Logo({
  className,
  logoUrl,
  name = "Nutriyet",
}: {
  className?: string;
  logoUrl?: string | null;
  name?: string;
}) {
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
          src={cldUrl(logoUrl, { h: 72 })}
          alt={name}
          className="h-8 w-auto max-w-[160px] object-contain"
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
