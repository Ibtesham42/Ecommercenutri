/**
 * Customer segmentation + registration-source helpers — client-safe (no imports)
 * so the admin table, filters and detail page all share one definition. Segments
 * are derived from lifetime paid spend + order count (no schema change); tune the
 * thresholds here in one place.
 */

export type CustomerSegment = "NEW" | "RETURNING" | "HIGH_VALUE" | "VIP";

const VIP_SPEND = 1_000_000; // ₹10,000 lifetime
const HIGH_VALUE_SPEND = 300_000; // ₹3,000 lifetime

export function customerSegment(spendPaise: number, orders: number): CustomerSegment {
  if (spendPaise >= VIP_SPEND) return "VIP";
  if (spendPaise >= HIGH_VALUE_SPEND) return "HIGH_VALUE";
  if (orders >= 2) return "RETURNING";
  return "NEW";
}

export const SEGMENT_VALUES: CustomerSegment[] = ["NEW", "RETURNING", "HIGH_VALUE", "VIP"];

export const SEGMENT_LABEL: Record<CustomerSegment, string> = {
  NEW: "New",
  RETURNING: "Returning",
  HIGH_VALUE: "High value",
  VIP: "VIP",
};

/** Tailwind classes for the segment badge (VIP gets the premium gold treatment). */
export const SEGMENT_BADGE_CLASS: Record<CustomerSegment, string> = {
  NEW: "bg-muted text-muted-foreground",
  RETURNING: "bg-accent text-accent-foreground",
  HIGH_VALUE: "bg-primary/10 text-primary",
  VIP: "bg-gold/15 text-gold ring-1 ring-gold/30",
};

export type RegistrationSource = "GOOGLE" | "PHONE" | "EMAIL";

export const SOURCE_LABEL: Record<RegistrationSource, string> = {
  GOOGLE: "Google",
  PHONE: "Phone OTP",
  EMAIL: "Email",
};

/** Infer how the customer signed up from available signals. */
export function registrationSource(opts: {
  providers: string[];
  phoneVerified: boolean;
}): RegistrationSource {
  if (opts.providers.includes("google")) return "GOOGLE";
  if (opts.phoneVerified) return "PHONE";
  return "EMAIL";
}

/** Initials for the avatar fallback. */
export function initials(name: string | null, email: string): string {
  const base = (name?.trim() || email).trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}
