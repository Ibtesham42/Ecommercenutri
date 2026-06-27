import type { ProductCardData } from "@/lib/queries/products";
import { recommendedForYou } from "@/lib/recommendations/service";

/**
 * Personalized recommendations. Thin wrapper kept for back-compat — the real
 * logic lives in the centralized recommendation service
 * (`lib/recommendations/service.ts#recommendedForYou`) so it's never duplicated.
 */
export async function getRecommendations(opts: {
  userId?: string | null;
  anonId?: string | null;
  excludeProductIds?: string[];
  limit?: number;
}): Promise<ProductCardData[]> {
  return recommendedForYou(opts);
}
