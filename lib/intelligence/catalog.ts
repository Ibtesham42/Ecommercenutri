/**
 * Competitor Intelligence — client-safe single-source-of-truth catalog.
 * Default watchlist, enum labels and score dimensions used by UI, validation
 * and analytics alike (same pattern as quiz/survey catalogs). Store KEYS,
 * render labels.
 */

export type DefaultCompetitor = {
  name: string;
  category: string;
  instagram?: string;
  website?: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
};

/** Seeded idempotently by ensureDefaultCompetitors() — admin can edit/remove. */
export const DEFAULT_COMPETITORS: DefaultCompetitor[] = [
  { name: "The Whole Truth", category: "Protein & clean label", instagram: "thewholetruthfoods", website: "https://thewholetruthfoods.com", priority: "HIGH" },
  { name: "Yoga Bar", category: "Protein & bars", instagram: "yogabar_official", website: "https://yogabars.in", priority: "HIGH" },
  { name: "Slurrp Farm", category: "Kids nutrition", instagram: "slurrpfarm", website: "https://slurrpfarm.com", priority: "MEDIUM" },
  { name: "Open Secret", category: "Healthy snacks", instagram: "opensecretsnacks", website: "https://opensecret.in", priority: "MEDIUM" },
  { name: "Farmley", category: "Dry fruits & makhana", instagram: "farmleyindia", website: "https://farmley.com", priority: "HIGH" },
  { name: "Happilo", category: "Dry fruits & nuts", instagram: "happilo_official", website: "https://happilo.com", priority: "HIGH" },
  { name: "Tata Soulfull", category: "Millets & breakfast", instagram: "tatasoulfull", website: "https://soulfull.co.in", priority: "MEDIUM" },
  { name: "RiteBite Max Protein", category: "Protein & bars", instagram: "maxprotein_in", website: "https://ritebite.in", priority: "LOW" },
  { name: "True Elements", category: "Breakfast & whole foods", instagram: "true.elements", website: "https://true-elements.com", priority: "MEDIUM" },
];

export const COMPETITOR_CATEGORIES = [
  "Healthy snacks",
  "Dry fruits & makhana",
  "Dry fruits & nuts",
  "Protein & clean label",
  "Protein & bars",
  "Kids nutrition",
  "Millets & breakfast",
  "Breakfast & whole foods",
  "Wellness & supplements",
  "Other",
] as const;

export const PRIORITY_LABEL: Record<string, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const INTEL_SOURCE_LABEL: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  LINKEDIN: "LinkedIn",
  YOUTUBE: "YouTube",
  BLOG: "Blog",
  WEBSITE: "Website",
  OTHER: "Other",
};

export const SIGNAL_KIND_LABEL: Record<string, string> = {
  POST: "Post",
  REEL: "Reel",
  CAROUSEL: "Carousel",
  STORY: "Story",
  VIDEO: "Video",
  BLOG_POST: "Blog post",
  PRODUCT_LAUNCH: "Product launch",
  CAMPAIGN: "Campaign",
  HASHTAG: "Hashtag trend",
  OTHER: "Other",
};

export const IDEA_FORMAT_LABEL: Record<string, string> = {
  REEL: "Reel",
  CAROUSEL: "Carousel",
  STORY: "Story",
  POST: "Post",
  BLOG: "Blog",
};

export const IDEA_DIFFICULTY_LABEL: Record<string, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

export const IDEA_STATUS_LABEL: Record<string, string> = {
  SUGGESTED: "Suggested",
  SHORTLISTED: "Shortlisted",
  USED: "Used",
  DISMISSED: "Dismissed",
};

/** The 7 quality dimensions every idea is scored on (0–100 each). */
export const IDEA_SCORE_DIMENSIONS = [
  { key: "originality", label: "Originality" },
  { key: "brandVoice", label: "Brand voice match" },
  { key: "educational", label: "Educational value" },
  { key: "trust", label: "Trust building" },
  { key: "share", label: "Share potential" },
  { key: "save", label: "Save potential" },
  { key: "seo", label: "SEO potential" },
] as const;

export type IdeaScoreKey = (typeof IDEA_SCORE_DIMENSIONS)[number]["key"];
export type IdeaScores = Record<IdeaScoreKey, number>;
