import Link from "next/link";

/** Thin promo bar at the very top of the storefront. Renders nothing unless an
 *  admin has enabled it with a message in Appearance settings. */
export function AnnouncementBar({
  active,
  message,
  link,
}: {
  active: boolean;
  message: string | null;
  link: string | null;
}) {
  if (!active || !message) return null;

  const content = (
    <span className="line-clamp-1 px-4">{message}</span>
  );

  return (
    <div className="bg-gradient-to-r from-primary via-primary to-emerald-600 text-center text-xs font-medium tracking-wide text-primary-foreground sm:text-sm">
      {link ? (
        <Link href={link} className="block py-2 transition-opacity hover:opacity-90 hover:underline">
          {content}
        </Link>
      ) : (
        <p className="py-2">{content}</p>
      )}
    </div>
  );
}
