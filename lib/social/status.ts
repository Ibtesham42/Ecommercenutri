import type { SocialPostStatus, SocialPublishMode } from "@prisma/client";

/**
 * Client-safe labels, badge variants and lifecycle transitions for social
 * posts. Kept free of server imports so both the admin UI and server logic can
 * share one source of truth (mirrors lib/marketing/automation-types.ts).
 */

export const POST_STATUS_LABEL: Record<SocialPostStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Needs approval",
  SCHEDULED: "Scheduled",
  PUBLISHING: "Publishing",
  PUBLISHED: "Published",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export const POST_STATUS_VARIANT: Record<SocialPostStatus, BadgeVariant> = {
  DRAFT: "secondary",
  PENDING_APPROVAL: "outline",
  SCHEDULED: "default",
  PUBLISHING: "outline",
  PUBLISHED: "default",
  FAILED: "destructive",
  CANCELLED: "secondary",
};

export const PUBLISH_MODE_LABEL: Record<SocialPublishMode, string> = {
  AUTO_PUBLISH: "Auto-publish",
  MANUAL_APPROVAL: "Manual approval",
  DRAFT: "Draft only",
};

export const PUBLISH_MODE_DESCRIPTION: Record<SocialPublishMode, string> = {
  AUTO_PUBLISH: "Generate and publish automatically at the scheduled time.",
  MANUAL_APPROVAL: "Generate drafts that need your approval before they publish.",
  DRAFT: "Only generate drafts — never schedule or publish automatically.",
};

/** Terminal statuses cannot transition further. */
export const TERMINAL_STATUSES: SocialPostStatus[] = ["PUBLISHED", "CANCELLED"];

/** Allowed manual transitions from the admin queue. */
const TRANSITIONS: Record<SocialPostStatus, SocialPostStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "SCHEDULED", "CANCELLED"],
  PENDING_APPROVAL: ["SCHEDULED", "DRAFT", "CANCELLED"],
  SCHEDULED: ["PUBLISHING", "DRAFT", "CANCELLED"],
  PUBLISHING: ["PUBLISHED", "FAILED"],
  PUBLISHED: [],
  FAILED: ["SCHEDULED", "DRAFT", "CANCELLED"],
  CANCELLED: ["DRAFT"],
};

export function canTransition(
  from: SocialPostStatus,
  to: SocialPostStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
