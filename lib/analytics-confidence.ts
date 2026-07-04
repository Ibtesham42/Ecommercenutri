/**
 * Statistical-significance floors for the engagement analytics. Below these,
 * numbers are dominated by noise (e.g. a section with 1 impression and 1 click
 * reads as "100% CTR"), so we withhold AI recommendations and rankings and show
 * "Not enough data yet" instead of misleading conclusions. Client-safe (plain
 * constants) so both the queries and the UI can import them.
 */

export const CONFIDENCE = {
  /** Journey funnel needs this many unique shopper sessions to be meaningful. */
  minJourneySessions: 30,
  /** Heatmap needs this many total section impressions before AI/ranking. */
  minHeatmapImpressions: 150,
  /** A single section needs this many impressions before it is scored/ranked. */
  minSectionImpressions: 25,
} as const;

export const NOT_ENOUGH_DATA = "Not enough data yet";

/** Standard "not enough data" line with the specific shortfall spelled out. */
export function notEnoughDataMessage(kind: "journey" | "heatmap", have: number, need: number): string {
  const unit = kind === "journey" ? "shopper sessions" : "section views";
  return `${NOT_ENOUGH_DATA} — ${have} ${unit} collected so far, ${need}+ needed for a reliable read. As traffic grows this will fill in automatically.`;
}
