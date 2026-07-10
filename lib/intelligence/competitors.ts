import "server-only";
import { prisma } from "@/lib/prisma";
import type { CompetitorPriority } from "@prisma/client";
import { DEFAULT_COMPETITORS } from "@/lib/intelligence/catalog";

/**
 * Idempotently seeds the default competitor watchlist (same pattern as
 * ensureBuiltInSocialTemplates): inserts only names that don't exist yet, so
 * admin edits/deletions are never clobbered.
 */
export async function ensureDefaultCompetitors(): Promise<number> {
  const existing = await prisma.competitor.findMany({ select: { name: true } });
  const have = new Set(existing.map((c) => c.name.toLowerCase()));
  const missing = DEFAULT_COMPETITORS.filter((c) => !have.has(c.name.toLowerCase()));
  if (!missing.length) return 0;
  await prisma.competitor.createMany({
    data: missing.map((c) => ({
      name: c.name,
      category: c.category,
      priority: c.priority as CompetitorPriority,
      instagram: c.instagram ?? null,
      website: c.website ?? null,
      isDefault: true,
    })),
    skipDuplicates: true,
  });
  return missing.length;
}
