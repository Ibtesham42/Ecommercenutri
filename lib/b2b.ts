import type { B2BStatus } from "@prisma/client";

/** Business types a buyer can self-identify as (form + admin filter). */
export const BUSINESS_TYPES = [
  "Distributor",
  "Wholesaler",
  "Retailer",
  "Supermarket",
  "Hotel",
  "Restaurant",
  "Café",
  "Corporate",
  "Nutrition Store",
  "Gym",
  "Pharmacy",
  "Other",
] as const;

/** Reasons for getting in touch (form + email). */
export const B2B_PURPOSES = [
  "Bulk Purchase",
  "Wholesale Pricing",
  "Distributor Partnership",
  "Corporate Order",
  "Franchise Inquiry",
  "General Business Inquiry",
  "Other",
] as const;

export const B2B_STATUSES: B2BStatus[] = [
  "NEW",
  "IN_REVIEW",
  "CONTACTED",
  "QUALIFIED",
  "CONVERTED",
  "CLOSED",
];

export const B2B_STATUS_LABELS: Record<B2BStatus, string> = {
  NEW: "New",
  IN_REVIEW: "In Review",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CONVERTED: "Converted",
  CLOSED: "Closed",
};

/** Color-coded badge classes per status (light + dark). */
export const B2B_STATUS_CLASS: Record<B2BStatus, string> = {
  NEW: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  IN_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  CONTACTED: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  QUALIFIED: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
  CONVERTED: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  CLOSED: "bg-muted text-muted-foreground",
};
