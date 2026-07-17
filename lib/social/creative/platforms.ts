/**
 * Per-platform canvas sizes the creative engine renders to. Client-safe catalog
 * (project convention): the admin UI, planner and renderer all read this one
 * module so a new platform size is added in exactly one place.
 */

export type PlatformKey =
  | "FEED"
  | "SQUARE"
  | "STORY"
  | "FACEBOOK"
  | "LINKEDIN"
  | "PINTEREST";

export type PlatformSize = {
  key: PlatformKey;
  label: string;
  width: number;
  height: number;
};

export const PLATFORM_SIZES: Record<PlatformKey, PlatformSize> = {
  FEED: { key: "FEED", label: "Instagram Feed (4:5)", width: 1080, height: 1350 },
  SQUARE: { key: "SQUARE", label: "Square", width: 1080, height: 1080 },
  STORY: { key: "STORY", label: "Story / Reel cover", width: 1080, height: 1920 },
  FACEBOOK: { key: "FACEBOOK", label: "Facebook", width: 1200, height: 630 },
  LINKEDIN: { key: "LINKEDIN", label: "LinkedIn", width: 1200, height: 627 },
  PINTEREST: { key: "PINTEREST", label: "Pinterest", width: 1000, height: 1500 },
};

export const DEFAULT_PLATFORM: PlatformKey = "FEED";
