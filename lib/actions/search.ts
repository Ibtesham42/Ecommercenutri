"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { MAX_RECENT_SEARCHES } from "@/lib/recent-searches";

/**
 * Per-account recent searches (the search overlay). Guests are a silent no-op —
 * they keep the localStorage list; the overlay treats a `null` from
 * `getMyRecentSearches` as "guest, use local". Never throws: history must not
 * be able to break search.
 */

const termSchema = z.string().trim().min(1).max(60);

/** Logged-in user's recents (newest first), or null for guests. */
export async function getMyRecentSearches(): Promise<string[] | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { recentSearches: true },
    });
    return row?.recentSearches ?? [];
  } catch {
    return null; // overlay falls back to localStorage
  }
}

export async function saveMyRecentSearch(input: unknown): Promise<{ ok: boolean }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: true };
    const parsed = termSchema.safeParse(input);
    if (!parsed.success) return { ok: false };
    const term = parsed.data;
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { recentSearches: true },
    });
    const rest = (row?.recentSearches ?? []).filter(
      (t) => t.toLowerCase() !== term.toLowerCase(),
    );
    await prisma.user.update({
      where: { id: user.id },
      data: { recentSearches: [term, ...rest].slice(0, MAX_RECENT_SEARCHES) },
    });
    return { ok: true };
  } catch (err) {
    console.error("[search] saveMyRecentSearch failed:", err);
    return { ok: false };
  }
}

export async function removeMyRecentSearch(input: unknown): Promise<{ ok: boolean }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: true };
    const parsed = termSchema.safeParse(input);
    if (!parsed.success) return { ok: false };
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { recentSearches: true },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        recentSearches: (row?.recentSearches ?? []).filter(
          (t) => t.toLowerCase() !== parsed.data.toLowerCase(),
        ),
      },
    });
    return { ok: true };
  } catch (err) {
    console.error("[search] removeMyRecentSearch failed:", err);
    return { ok: false };
  }
}

export async function clearMyRecentSearches(): Promise<{ ok: boolean }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: true };
    await prisma.user.update({ where: { id: user.id }, data: { recentSearches: [] } });
    return { ok: true };
  } catch (err) {
    console.error("[search] clearMyRecentSearches failed:", err);
    return { ok: false };
  }
}
