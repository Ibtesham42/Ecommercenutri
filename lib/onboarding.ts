/**
 * Pure logic for the first-visit sign-in spotlight (no React/DOM imports, so it
 * is trivially testable). The component reads localStorage + pathname and
 * delegates the decision here.
 */

export const ONBOARD_SEEN_KEY = "nut_onboard_signin";

/** Routes where a first-visit nudge would distract from the task at hand. */
export const ONBOARD_HIDE_ON = ["/checkout"];

/**
 * Should the spotlight reveal for this visitor? True only for a first-time
 * visitor (the "seen" flag is unset) on a non-excluded route.
 */
export function shouldRevealSpotlight(pathname: string, seen: string | null): boolean {
  if (ONBOARD_HIDE_ON.some((p) => pathname.startsWith(p))) return false;
  return seen !== "1";
}
