export const siteConfig = {
  name: "Nutriyet",
  domain: "nutriyet.in",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://nutriyet.in",
  tagline: "Eat clean. Live strong.",
  description:
    "Nutriyet is India's AI-powered health & nutrition marketplace — premium makhana, dry fruits, seeds, protein, healthy snacks, organic and wellness products, with an AI nutrition expert to guide every purchase.",
  keywords: [
    "makhana",
    "dry fruits",
    "seeds",
    "protein",
    "healthy snacks",
    "organic food",
    "wellness",
    "nutrition",
    "Nutriyet",
  ],
  ogImage: "/opengraph-image",
  contact: {
    email: "support@nutriyet.in",
    phone: "+91 90000 00000",
  },
  social: {
    instagram: "https://instagram.com/nutriyet",
    facebook: "https://facebook.com/nutriyet",
    twitter: "https://twitter.com/nutriyet",
    youtube: "https://youtube.com/@nutriyet",
  },
  mainNav: [
    { title: "Home", href: "/" },
    { title: "Shop", href: "/products" },
    { title: "Categories", href: "/categories" },
    { title: "Best Sellers", href: "/products?sort=best-sellers" },
    { title: "AI Assistant", href: "/assistant" },
    { title: "B2B", href: "/b2b" },
    { title: "About", href: "/about" },
    { title: "Contact", href: "/contact" },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
