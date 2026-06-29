import type {
  CampaignChannel,
  CampaignStatus,
  CampaignType,
  SegmentType,
  AutomationTrigger,
} from "@prisma/client";

/**
 * Client-safe marketing metadata (type-only Prisma imports). Channel/segment/status
 * labels + which channels are live today. Push/WhatsApp/SMS are registered but not
 * yet wired — the dispatch adapter registry (`lib/marketing/deliver.ts`) no-ops them,
 * so the UI can offer them as "coming soon" without breaking sends.
 */

export const CHANNELS: CampaignChannel[] = ["IN_APP", "EMAIL", "PUSH", "WHATSAPP", "SMS"];

export const CHANNEL_LABEL: Record<CampaignChannel, string> = {
  IN_APP: "In-App",
  EMAIL: "Email",
  PUSH: "Push",
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
};

/** Channels that actually deliver today; the rest are future-ready stubs. */
export const CHANNEL_LIVE: Record<CampaignChannel, boolean> = {
  IN_APP: true,
  EMAIL: true,
  PUSH: false,
  WHATSAPP: false,
  SMS: false,
};

export const SEGMENTS: SegmentType[] = [
  "ALL_USERS",
  "CUSTOMERS",
  "AFFILIATES",
  "PRODUCT_BUYERS",
  "CATEGORY_BUYERS",
  "WISHLIST",
  "ABANDONED_CART",
  "INACTIVE",
  "SELECTED",
];

export const SEGMENT_LABEL: Record<SegmentType, string> = {
  ALL_USERS: "All users",
  CUSTOMERS: "Customers (with orders)",
  AFFILIATES: "Affiliates",
  PRODUCT_BUYERS: "Bought a product",
  CATEGORY_BUYERS: "Bought from a category",
  WISHLIST: "Wishlisted a product",
  ABANDONED_CART: "Abandoned cart",
  INACTIVE: "Inactive users",
  SELECTED: "Selected users",
};

export const SEGMENT_DESCRIPTION: Record<SegmentType, string> = {
  ALL_USERS: "Every registered customer account.",
  CUSTOMERS: "Users who have placed at least one order.",
  AFFILIATES: "Approved affiliate partners.",
  PRODUCT_BUYERS: "Users who purchased a specific product.",
  CATEGORY_BUYERS: "Users who purchased from a specific category.",
  WISHLIST: "Users with items on their wishlist.",
  ABANDONED_CART: "Users with items left in their cart.",
  INACTIVE: "Users with no orders in the selected window.",
  SELECTED: "A hand-picked list of users.",
};

/** Which segment types need extra config (product / category / userIds / days). */
export const SEGMENT_NEEDS = {
  product: ["PRODUCT_BUYERS", "WISHLIST"] as SegmentType[],
  category: ["CATEGORY_BUYERS"] as SegmentType[],
  inactiveDays: ["INACTIVE"] as SegmentType[],
  userIds: ["SELECTED"] as SegmentType[],
};

export const CAMPAIGN_TYPE_LABEL: Record<CampaignType, string> = {
  BROADCAST: "Broadcast",
  PRODUCT: "Product",
  COUPON: "Coupon",
  AUTOMATION: "Automation",
};

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  SENDING: "Sending",
  SENT: "Sent",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export const STATUS_VARIANT: Record<CampaignStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SCHEDULED: "outline",
  SENDING: "outline",
  SENT: "default",
  FAILED: "destructive",
  CANCELLED: "destructive",
};

export const TEMPLATE_CATEGORIES = [
  "PROMO",
  "PRODUCT_LAUNCH",
  "WELCOME",
  "WINBACK",
  "COUPON",
  "NEWSLETTER",
] as const;

export const AUTOMATION_TRIGGERS: AutomationTrigger[] = [
  "WELCOME",
  "ABANDONED_CART",
  "WINBACK",
  "POST_PURCHASE",
];

export const AUTOMATION_TRIGGER_LABEL: Record<AutomationTrigger, string> = {
  WELCOME: "Welcome new customer",
  ABANDONED_CART: "Abandoned cart",
  WINBACK: "Win back inactive",
  POST_PURCHASE: "After purchase",
};

export const AUTOMATION_TRIGGER_DESCRIPTION: Record<AutomationTrigger, string> = {
  WELCOME: "Sends once after a new account is created.",
  ABANDONED_CART: "Sends when a cart sits with items and no order.",
  WINBACK: "Sends to customers with no recent orders.",
  POST_PURCHASE: "Sends after an order is delivered (per order).",
};

export const TEMPLATE_CATEGORY_LABEL: Record<string, string> = {
  PROMO: "Promotion",
  PRODUCT_LAUNCH: "Product launch",
  WELCOME: "Welcome",
  WINBACK: "Win-back",
  COUPON: "Coupon",
  NEWSLETTER: "Newsletter",
};
