import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [
    users,
    admins,
    categories,
    brands,
    products,
    variants,
    images,
    reviews,
    coupons,
    stories,
    storyViews,
    aiSettings,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.category.count(),
    prisma.brand.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.productImage.count(),
    prisma.review.count(),
    prisma.coupon.count(),
    prisma.story.count(),
    prisma.storyView.count(),
    prisma.aISetting.count(),
  ]);

  console.log("\n📊 Record counts");
  console.table({
    users,
    admins,
    categories,
    brands,
    products,
    variants,
    images,
    reviews,
    coupons,
    stories,
    storyViews,
    aiSettings,
  });

  // Sample relational query
  const sample = await prisma.product.findFirst({
    where: { slug: "premium-roasted-makhana" },
    include: {
      category: true,
      brand: true,
      variants: { orderBy: { weightInGrams: "asc" } },
      images: true,
    },
  });
  console.log(
    `\n🔎 Sample product: "${sample?.name}" | category: ${sample?.category.name} | brand: ${sample?.brand?.name}`,
  );
  console.log(
    "   variants:",
    sample?.variants
      .map((v) => `${v.weightLabel} ₹${((v.discountPrice ?? v.price) / 100).toFixed(0)}`)
      .join(", "),
  );
  console.log("   images:", sample?.images.length);

  const featured = await prisma.product.count({ where: { isFeatured: true } });
  const best = await prisma.product.count({ where: { isBestSeller: true } });
  console.log(`\n⭐ featured: ${featured} | bestSellers: ${best}`);

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { email: true, role: true, emailVerified: true },
  });
  console.log("👤 admin:", admin);

  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name`,
  );
  console.log(`\n🗄️  tables (${tables.length}):`);
  console.log("   " + tables.map((t) => t.table_name).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
