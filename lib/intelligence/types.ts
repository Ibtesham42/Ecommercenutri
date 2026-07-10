/**
 * Typed payloads stored in IntelligenceReport.data (client-safe — no server
 * imports). All content is analytical: patterns, trends and opportunities.
 * Competitor wording/creatives are never stored or reproduced.
 */

export type CompetitorProfileData = {
  postingFrequency: string; // e.g. "~5 posts/week, reels-heavy"
  postingTimes: string; // observed best windows
  contentPillars: string[];
  captionStyle: string;
  hookStyle: string;
  ctaStyle: string;
  carouselStructure: string;
  reelFormat: string;
  visualStyle: string; // image + video style, described analytically
  brandTone: string;
  engagementPattern: string;
  trendingHashtags: string[];
  audienceReactions: string;
  commonQuestions: string[];
  frequentTopics: string[];
  takeaways: string[]; // what Nutriyet can LEARN (never copy)
};

export type TrendTopic = {
  topic: string;
  momentum: "rising" | "steady" | "cooling";
  note: string;
};

export type MarketTrendsData = {
  trendingTopics: TrendTopic[];
  ingredients: string[]; // most discussed ingredients
  healthConcerns: string[]; // most discussed health concerns
  snackCategories: string[]; // popular categories right now
  seasonal: string[]; // seasonal trends in window
  festivals: { name: string; window: string; angle: string }[]; // upcoming opportunities
  emergingTopics: string[]; // early, under-covered nutrition topics
  topThemes: { theme: string; note: string }[]; // best-performing market themes
};

export type ContentGap = {
  gap: string; // what nobody covers well
  evidence: string; // why we believe it's a gap
  opportunity: string; // the original Nutriyet angle
  priority: "HIGH" | "MEDIUM" | "LOW";
};

export type ContentGapsData = {
  gaps: ContentGap[];
  recommendedCampaigns: { name: string; theme: string; why: string }[];
};

export type ReportPayload =
  | CompetitorProfileData
  | MarketTrendsData
  | ContentGapsData;
