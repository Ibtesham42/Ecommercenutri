export const siteConfig = {
  name: "Nutriyet",
  domain: "nutriyet.in",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://nutriyet.in",
  tagline: "Rooted in Tradition. Made for Today.",
  description:
    "Nutriyet is an Indian food brand rooted in the traditions of Bihar and Mithila — makhana, spices and everyday pantry staples, thoughtfully prepared and honestly labelled, with an AI assistant on hand if you have a question.",
  keywords: [
    "makhana",
    "fox nuts",
    "desi spices",
    "moringa powder",
    "Bihar food",
    "Mithila food",
    "Indian pantry staples",
    "Nutriyet",
  ],
  ogImage: "/brand-og-image",
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
    { title: "New Arrivals", href: "/new-arrivals" },
    { title: "Offers", href: "/offers" },
    { title: "AI Assistant", href: "/assistant" },
    { title: "B2B", href: "/b2b" },
    { title: "About", href: "/about" },
    { title: "Contact", href: "/contact" },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
