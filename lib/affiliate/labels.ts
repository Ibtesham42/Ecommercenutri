import type {
  AffiliateRole,
  AffiliateStatus,
  CommissionStatus,
  PayoutStatus,
  MarketingAssetType,
} from "@prisma/client";

/** Client-safe display labels (only type imports — no runtime Prisma). */

export const AFFILIATE_ROLE_LABEL: Record<AffiliateRole, string> = {
  INFLUENCER: "Influencer",
  AFFILIATE: "Affiliate",
  BRAND_AMBASSADOR: "Brand Ambassador",
  NUTRITIONIST: "Nutritionist",
  GYM_PARTNER: "Gym Partner",
  BLOGGER: "Blogger",
  YOUTUBE_CREATOR: "YouTube Creator",
  INSTAGRAM_CREATOR: "Instagram Creator",
};

export const AFFILIATE_STATUS_LABEL: Record<AffiliateStatus, string> = {
  PENDING: "Pending review",
  APPROVED: "Active",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

export const COMMISSION_STATUS_LABEL: Record<CommissionStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  PROCESSING: "Processing",
  PAID: "Paid",
  REJECTED: "Rejected",
};

export const MARKETING_ASSET_LABEL: Record<MarketingAssetType, string> = {
  PRODUCT_IMAGE: "Product image",
  BANNER: "Banner",
  LOGO: "Logo",
  PDF: "PDF",
  SOCIAL_CREATIVE: "Social creative",
  STORY_TEMPLATE: "Story template",
  REEL_ASSET: "Reel asset",
  VIDEO: "Video",
  CATALOGUE: "Catalogue",
};
