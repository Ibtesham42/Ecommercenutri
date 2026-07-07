import Link from "next/link";

/** Coupon-like tokens (mixed caps + digits, e.g. HEALTHY20) get the gold
 *  accent so the code reads at a glance. Split with a capture group: odd
 *  indices are the matches. */
function renderMessage(message: string) {
  const parts = message.split(/(\b(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]{5,}\b)/);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="font-semibold tracking-wider text-gold">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/** Thin promo bar at the very top of the storefront. Renders nothing unless an
 *  admin has enabled it with a message in Appearance settings. Shares the deep
 *  masthead surface with the OfferBar above it (hairline divider between the
 *  two) so the top of the page reads as one considered block, not two
 *  competing promo bars. */
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
    // Mobile gets two balanced lines before clamping — a coupon code cut mid-
    // string ("…use coupon HEALTHY2") is worse than a slightly taller bar.
    <span className="line-clamp-2 px-4 max-sm:text-balance sm:line-clamp-1">
      {renderMessage(message)}
    </span>
  );

  return (
    <div className="border-t border-white/10 bg-surface-deep text-center text-xs font-medium tracking-wide text-surface-deep-foreground/85 sm:text-sm">
      {link ? (
        <Link
          href={link}
          className="block py-2 transition-colors hover:text-surface-deep-foreground hover:underline"
        >
          {content}
        </Link>
      ) : (
        <p className="py-2">{content}</p>
      )}
    </div>
  );
}
