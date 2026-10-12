import type { Prisma } from "@prisma/client";

type VariantReader = {
  productVariant: {
    findMany: (args: {
      where: { id: { in: string[] } };
      select: { id: true; productId: true; weightLabel: true; weightInGrams: true; product: { select: { name: true } } };
    }) => Promise<{ id: string; productId: string; weightLabel: string; weightInGrams: number | null; product: { name: string } }[]>;
  };
};

/**
 * Test-only: the fields an admin's eligibility verification would write for
 * `variantIds` (lib/actions/admin/spin.ts#verifySpinEligibility), built from
 * the test database's catalogue. Campaigns without them are never live.
 */
export async function verifiedEligibility(db: VariantReader, variantIds: string[]) {
  const rows = await db.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, productId: true, weightLabel: true, weightInGrams: true, product: { select: { name: true } } },
  });
  return {
    eligibleVariantIds: variantIds,
    eligibilityVerifiedAt: new Date(),
    eligibilitySnapshot: rows.map((v) => ({
      variantId: v.id,
      productId: v.productId,
      productName: v.product.name,
      weightLabel: v.weightLabel,
      weightInGrams: v.weightInGrams,
    })) as unknown as Prisma.InputJsonValue,
  };
}
