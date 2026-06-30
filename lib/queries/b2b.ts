import { prisma } from "@/lib/prisma";

/** Dashboard B2B summary (total, new, contacted, converted + conversion rate). */
export async function getB2BStats() {
  try {
    const [total, neu, contacted, converted] = await Promise.all([
      prisma.b2BInquiry.count(),
      prisma.b2BInquiry.count({ where: { status: "NEW" } }),
      prisma.b2BInquiry.count({ where: { status: "CONTACTED" } }),
      prisma.b2BInquiry.count({ where: { status: "CONVERTED" } }),
    ]);
    return {
      total,
      new: neu,
      contacted,
      converted,
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
    };
  } catch {
    return { total: 0, new: 0, contacted: 0, converted: 0, conversionRate: 0 };
  }
}
