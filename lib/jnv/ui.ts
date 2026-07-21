/**
 * Shared layout primitives for the JNV student portal so every page scales
 * the same way from a phone up to a 4K smart board / interactive panel —
 * `max-w-7xl` alone caps content at 1280px even on an 85" display, wasting
 * the screen a classroom actually uses this module on. `jnv-container` /
 * `jnv-chrome` are also CSS hooks for Presentation Mode (see
 * `app/jnv/presentation.css`) — keep them on every element that should
 * widen or hide when it's active.
 */

/** Outer content wrapper: wide-screen aware max-width + padding. */
export const JNV_CONTAINER =
  "jnv-container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 2xl:max-w-[1760px] 2xl:px-12";

/** Slightly narrower variant for reading-focused pages (search, viewer text). */
export const JNV_CONTAINER_NARROW =
  "jnv-container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 2xl:max-w-[1400px] 2xl:px-12";

/** Class-picker grid: 5 cards, one per class — spreads out on ultra-wide displays. */
export const JNV_CLASS_GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:gap-6";

/** Folder/resource card grids used on class, folder and search pages. */
export const JNV_CARD_GRID =
  "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 2xl:gap-6 3xl:grid-cols-6";
