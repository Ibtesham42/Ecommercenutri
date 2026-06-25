import { PrismaClient, CouponType, StoryMediaType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const img = (name: string) =>
  `https://placehold.co/800x800/e7f6ec/16803c?text=${encodeURIComponent(name)}`;

const categories = [
  { name: "Makhana", slug: "makhana", description: "Roasted fox nuts — light, crunchy and protein-rich." },
  { name: "Dry Fruits", slug: "dry-fruits", description: "Premium almonds, cashews, raisins and more." },
  { name: "Seeds", slug: "seeds", description: "Chia, flax, pumpkin and sunflower seeds." },
  { name: "Protein", slug: "protein", description: "Plant and whey protein for active lifestyles." },
  { name: "Healthy Snacks", slug: "healthy-snacks", description: "Guilt-free snacking, done right." },
  { name: "Organic Foods", slug: "organic-foods", description: "Certified organic staples for clean eating." },
  { name: "Wellness", slug: "wellness", description: "Supplements and superfoods for daily wellbeing." },
];

type SeedProduct = {
  name: string;
  slug: string;
  category: string;
  shortDescription: string;
  description: string;
  benefits: string;
  ingredients: string;
  nutrition: { label: string; value: string }[];
  featured?: boolean;
  bestSeller?: boolean;
  // [weightLabel, grams, pricePaise, discountPaise|null, stock]
  variants: [string, number, number, number | null, number][];
};

const products: SeedProduct[] = [
  {
    name: "Premium Roasted Makhana",
    slug: "premium-roasted-makhana",
    category: "makhana",
    shortDescription: "Crunchy roasted fox nuts, lightly salted.",
    description:
      "Hand-picked, jumbo-sized fox nuts roasted to a perfect crunch. A wholesome, low-calorie snack you can enjoy any time of day.",
    benefits:
      "High in protein and fiber, low in calories, gluten-free, supports weight management and heart health.",
    ingredients: "Fox nuts (makhana), a pinch of pink salt, cold-pressed oil.",
    nutrition: [
      { label: "Energy", value: "347 kcal" },
      { label: "Protein", value: "9.7 g" },
      { label: "Carbohydrates", value: "76 g" },
      { label: "Fat", value: "0.1 g" },
      { label: "Fiber", value: "14.5 g" },
    ],
    featured: true,
    bestSeller: true,
    variants: [
      ["100g", 100, 14900, 12900, 120],
      ["250g", 250, 32900, 28900, 90],
      ["500g", 500, 59900, 53900, 60],
      ["1kg", 1000, 109900, 99900, 40],
    ],
  },
  {
    name: "Peri Peri Makhana",
    slug: "peri-peri-makhana",
    category: "makhana",
    shortDescription: "Spicy peri peri roasted fox nuts.",
    description:
      "All the crunch of our classic makhana with a fiery peri peri twist. The perfect spicy, guilt-free snack.",
    benefits: "Protein-rich, low-fat, satisfies spicy cravings without the guilt.",
    ingredients: "Fox nuts, peri peri seasoning, cold-pressed oil, pink salt.",
    nutrition: [
      { label: "Energy", value: "352 kcal" },
      { label: "Protein", value: "9.5 g" },
      { label: "Carbohydrates", value: "75 g" },
      { label: "Fat", value: "1.2 g" },
    ],
    bestSeller: true,
    variants: [
      ["100g", 100, 15900, 13900, 100],
      ["250g", 250, 34900, 29900, 70],
      ["500g", 500, 62900, 56900, 45],
    ],
  },
  {
    name: "California Almonds",
    slug: "california-almonds",
    category: "dry-fruits",
    shortDescription: "Premium whole California almonds.",
    description:
      "Crunchy, naturally sweet whole almonds sourced from the finest California orchards. A daily handful of goodness.",
    benefits: "Rich in vitamin E, healthy fats and protein; supports brain and heart health.",
    ingredients: "100% California almonds.",
    nutrition: [
      { label: "Energy", value: "579 kcal" },
      { label: "Protein", value: "21 g" },
      { label: "Fat", value: "49 g" },
      { label: "Fiber", value: "12.5 g" },
    ],
    featured: true,
    bestSeller: true,
    variants: [
      ["250g", 250, 39900, 34900, 80],
      ["500g", 500, 74900, 67900, 55],
      ["1kg", 1000, 139900, 124900, 30],
    ],
  },
  {
    name: "Whole Cashews (W320)",
    slug: "whole-cashews-w320",
    category: "dry-fruits",
    shortDescription: "Creamy premium grade W320 cashews.",
    description:
      "Buttery, crunchy W320 grade cashews — perfect for snacking, cooking and gifting.",
    benefits: "Good source of magnesium, copper and healthy fats; supports bone and heart health.",
    ingredients: "100% whole cashew nuts.",
    nutrition: [
      { label: "Energy", value: "553 kcal" },
      { label: "Protein", value: "18 g" },
      { label: "Fat", value: "44 g" },
    ],
    featured: true,
    variants: [
      ["250g", 250, 44900, 39900, 70],
      ["500g", 500, 84900, 76900, 40],
      ["1kg", 1000, 159900, 144900, 25],
    ],
  },
  {
    name: "Seedless Black Raisins",
    slug: "seedless-black-raisins",
    category: "dry-fruits",
    shortDescription: "Naturally sweet seedless black raisins.",
    description: "Sun-dried seedless black raisins — a naturally sweet energy boost.",
    benefits: "Rich in iron and antioxidants; aids digestion and boosts energy.",
    ingredients: "100% black raisins.",
    nutrition: [
      { label: "Energy", value: "299 kcal" },
      { label: "Protein", value: "3.1 g" },
      { label: "Carbohydrates", value: "79 g" },
    ],
    variants: [
      ["250g", 250, 19900, 16900, 90],
      ["500g", 500, 36900, 32900, 60],
    ],
  },
  {
    name: "Organic Chia Seeds",
    slug: "organic-chia-seeds",
    category: "seeds",
    shortDescription: "Omega-3 rich organic chia seeds.",
    description:
      "Nutrient-dense organic chia seeds — add them to smoothies, puddings and bakes for a fiber and omega-3 boost.",
    benefits: "Loaded with omega-3, fiber and protein; supports digestion and satiety.",
    ingredients: "100% organic chia seeds.",
    nutrition: [
      { label: "Energy", value: "486 kcal" },
      { label: "Protein", value: "17 g" },
      { label: "Fiber", value: "34 g" },
      { label: "Omega-3", value: "17.8 g" },
    ],
    featured: true,
    bestSeller: true,
    variants: [
      ["200g", 200, 17900, 14900, 110],
      ["500g", 500, 36900, 31900, 70],
      ["1kg", 1000, 64900, 57900, 35],
    ],
  },
  {
    name: "Roasted Flax Seeds",
    slug: "roasted-flax-seeds",
    category: "seeds",
    shortDescription: "Crunchy roasted flax seeds.",
    description: "Lightly roasted flax seeds — a fiber-rich topping for every meal.",
    benefits: "High in omega-3 and lignans; supports heart health and digestion.",
    ingredients: "100% roasted flax seeds.",
    nutrition: [
      { label: "Energy", value: "534 kcal" },
      { label: "Protein", value: "18 g" },
      { label: "Fiber", value: "27 g" },
    ],
    variants: [
      ["250g", 250, 14900, 12900, 95],
      ["500g", 500, 26900, 23900, 60],
    ],
  },
  {
    name: "Mixed Super Seeds",
    slug: "mixed-super-seeds",
    category: "seeds",
    shortDescription: "Chia, flax, pumpkin & sunflower blend.",
    description:
      "A balanced blend of chia, flax, pumpkin and sunflower seeds — your daily dose of plant-based nutrition.",
    benefits: "All-in-one source of omega-3, protein, zinc and fiber.",
    ingredients: "Chia seeds, flax seeds, pumpkin seeds, sunflower seeds.",
    nutrition: [
      { label: "Energy", value: "522 kcal" },
      { label: "Protein", value: "22 g" },
      { label: "Fiber", value: "20 g" },
    ],
    bestSeller: true,
    variants: [
      ["250g", 250, 24900, 21900, 80],
      ["500g", 500, 45900, 39900, 50],
    ],
  },
  {
    name: "Plant Protein — Chocolate",
    slug: "plant-protein-chocolate",
    category: "protein",
    shortDescription: "Vegan pea & brown rice protein, 24g/serving.",
    description:
      "Smooth chocolate plant protein blending pea and brown rice protein — 24g of protein per serving with no added sugar.",
    benefits: "Supports muscle recovery and growth; vegan, lactose-free and easy to digest.",
    ingredients: "Pea protein isolate, brown rice protein, cocoa, natural flavor, stevia.",
    nutrition: [
      { label: "Energy", value: "120 kcal" },
      { label: "Protein", value: "24 g" },
      { label: "Carbohydrates", value: "3 g" },
      { label: "Sugar", value: "0 g" },
    ],
    featured: true,
    variants: [
      ["500g", 500, 89900, 79900, 45],
      ["1kg", 1000, 159900, 144900, 25],
    ],
  },
  {
    name: "Energy Trail Mix",
    slug: "energy-trail-mix",
    category: "healthy-snacks",
    shortDescription: "Nuts, seeds & berries on the go.",
    description:
      "A wholesome mix of almonds, cashews, cranberries, pumpkin seeds and raisins — perfect for an energy boost anytime.",
    benefits: "Balanced protein, healthy fats and natural sugars for sustained energy.",
    ingredients: "Almonds, cashews, cranberries, pumpkin seeds, raisins.",
    nutrition: [
      { label: "Energy", value: "462 kcal" },
      { label: "Protein", value: "14 g" },
      { label: "Fat", value: "30 g" },
    ],
    bestSeller: true,
    variants: [
      ["200g", 200, 24900, 21900, 85],
      ["400g", 400, 44900, 39900, 50],
    ],
  },
  {
    name: "Organic Quinoa",
    slug: "organic-quinoa",
    category: "organic-foods",
    shortDescription: "Protein-packed organic white quinoa.",
    description:
      "Certified organic white quinoa — a complete protein and versatile grain for healthy bowls and salads.",
    benefits: "Complete plant protein with all nine essential amino acids; gluten-free.",
    ingredients: "100% organic white quinoa.",
    nutrition: [
      { label: "Energy", value: "368 kcal" },
      { label: "Protein", value: "14 g" },
      { label: "Fiber", value: "7 g" },
    ],
    featured: true,
    variants: [
      ["500g", 500, 32900, 28900, 70],
      ["1kg", 1000, 59900, 53900, 40],
    ],
  },
  {
    name: "Raw Forest Honey",
    slug: "raw-forest-honey",
    category: "wellness",
    shortDescription: "Unprocessed raw forest honey.",
    description:
      "Pure, raw and unpasteurized forest honey — nature's sweetener with all its goodness intact.",
    benefits: "Natural antioxidants and antibacterial properties; soothes and energizes.",
    ingredients: "100% raw forest honey.",
    nutrition: [
      { label: "Energy", value: "304 kcal" },
      { label: "Carbohydrates", value: "82 g" },
      { label: "Sugar", value: "82 g" },
    ],
    bestSeller: true,
    variants: [
      ["350g", 350, 29900, 24900, 90],
      ["700g", 700, 54900, 47900, 50],
    ],
  },
];

const coupons = [
  {
    code: "WELCOME10",
    description: "10% off your first order",
    type: CouponType.PERCENT,
    value: 10,
    minOrder: 49900,
    maxDiscount: 20000,
    perUserLimit: 1,
  },
  {
    code: "FLAT100",
    description: "₹100 off orders above ₹799",
    type: CouponType.FIXED,
    value: 10000,
    minOrder: 79900,
  },
  {
    code: "HEALTHY20",
    description: "20% off wellness range",
    type: CouponType.PERCENT,
    value: 20,
    minOrder: 99900,
    maxDiscount: 30000,
  },
];

async function main() {
  console.log("🌱 Seeding Nutriyet database...");

  // AI settings singleton
  await prisma.aISetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      systemPrompt:
        "You are Nutriyet's friendly AI nutrition expert. Answer using the product catalog and sound nutrition science. Be concise, practical and encouraging.",
    },
  });

  // Brand
  const brand = await prisma.brand.upsert({
    where: { slug: "nutriyet" },
    update: {},
    create: {
      name: "Nutriyet",
      slug: "nutriyet",
      logo: img("Nutriyet"),
      description: "Nutriyet's own range of premium health foods.",
    },
  });

  // Categories
  const categoryBySlug = new Map<string, string>();
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    const created = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description },
      create: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        image: img(c.name),
        sortOrder: i,
      },
    });
    categoryBySlug.set(c.slug, created.id);
  }

  // Products + variants + images
  for (const p of products) {
    const categoryId = categoryBySlug.get(p.category)!;
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } });

    if (existing) {
      await prisma.product.update({
        where: { slug: p.slug },
        data: {
          name: p.name,
          shortDescription: p.shortDescription,
          description: p.description,
          benefits: p.benefits,
          ingredients: p.ingredients,
          nutritionFacts: p.nutrition,
          isFeatured: p.featured ?? false,
          isBestSeller: p.bestSeller ?? false,
          categoryId,
          brandId: brand.id,
        },
      });
      continue;
    }

    await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        shortDescription: p.shortDescription,
        description: p.description,
        benefits: p.benefits,
        ingredients: p.ingredients,
        nutritionFacts: p.nutrition,
        isFeatured: p.featured ?? false,
        isBestSeller: p.bestSeller ?? false,
        ratingAvg: 4.5 + Math.random() * 0.5,
        ratingCount: 20 + Math.floor(Math.random() * 200),
        categoryId,
        brandId: brand.id,
        images: {
          create: [
            { url: img(p.name), alt: p.name, isMain: true, sortOrder: 0 },
            { url: img(`${p.name} 2`), alt: `${p.name} alternate`, sortOrder: 1 },
          ],
        },
        variants: {
          create: p.variants.map(([label, grams, price, discount, stock], idx) => ({
            weightLabel: label,
            weightInGrams: grams,
            price,
            discountPrice: discount,
            stock,
            isDefault: idx === 0,
          })),
        },
      },
    });
  }

  // Coupons
  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
  }

  // Admin user
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@nutriyet.in";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: {
      name: "Nutriyet Admin",
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });

  // Stories linked to a couple of featured products
  const storyProducts = await prisma.product.findMany({
    where: { slug: { in: ["premium-roasted-makhana", "organic-chia-seeds", "california-almonds"] } },
  });
  for (let i = 0; i < storyProducts.length; i++) {
    const sp = storyProducts[i];
    const title = `Spotlight: ${sp.name}`;
    const exists = await prisma.story.findFirst({ where: { title } });
    if (exists) continue;
    await prisma.story.create({
      data: {
        title,
        coverImage: img(sp.name),
        mediaUrl: img(`${sp.name} story`),
        mediaType: StoryMediaType.IMAGE,
        productId: sp.id,
        ctaText: "Shop now",
        isPublished: true,
        sortOrder: i,
      },
    });
  }

  console.log("✅ Seed complete.");
  console.log(`   Admin login: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
