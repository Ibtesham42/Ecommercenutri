import type {
  HeroContent,
  AiBannerContent,
  HeadingContent,
  WhyChooseUsContent,
  TestimonialsContent,
  HomeContentKey,
} from "@/lib/validations/admin";
import type { HomeSectionKey } from "@/lib/home-sections";

/**
 * Editable content for each homepage section (Homepage Section editor). These
 * defaults mirror the original hardcoded homepage, so the page is unchanged
 * until an admin edits a section. Stored per-section as `HomeSection.content`
 * JSON and merged over these defaults by `getHomeSectionsContent()`.
 */
export type HomeContentMap = {
  hero: HeroContent;
  aiBanner: AiBannerContent;
  categories: HeadingContent;
  featured: HeadingContent;
  bestSellers: HeadingContent;
  recommended: HeadingContent;
  whyChooseUs: WhyChooseUsContent;
  testimonials: TestimonialsContent;
};

export const HOME_CONTENT_DEFAULTS: HomeContentMap = {
  hero: {
    eyebrow: "AI-powered nutrition marketplace",
    title: "Eat clean.",
    highlight: "Live strong.",
    description:
      "Premium makhana, dry fruits, seeds, protein and wellness essentials — handpicked for your health and guided by your own AI nutrition expert.",
    primaryLabel: "Shop Now",
    primaryHref: "/products",
    secondaryLabel: "Ask the AI Expert",
    secondaryHref: "/assistant",
    stats: [
      { value: "10k+", label: "Happy customers" },
      { value: "4.8★", label: "Average rating" },
      { value: "100%", label: "Natural & clean" },
    ],
    bgColor: null,
    textColor: null,
  },
  aiBanner: {
    eyebrow: "Powered by Groq AI",
    title: "Not sure what to buy? Ask our AI nutrition expert.",
    description:
      "“What is makhana?” · “Best foods for weight loss?” · “Compare almonds and cashews” — get instant, science-backed answers grounded in our catalog.",
    ctaLabel: "Start chatting",
    ctaHref: "/assistant",
    bgColor: null,
    textColor: null,
  },
  categories: {
    title: "Shop by category",
    subtitle: "Find exactly what your body craves.",
    ctaLabel: "View all",
    ctaHref: "/categories",
    limit: 6,
  },
  featured: {
    title: "Featured products",
    subtitle: "Handpicked favorites we think you'll love.",
    ctaLabel: "View all",
    ctaHref: "/products",
    limit: 8,
  },
  bestSellers: {
    title: "Best sellers",
    subtitle: "What everyone's adding to cart.",
    ctaLabel: "View all",
    ctaHref: "/products?sort=best-sellers",
    limit: 8,
  },
  recommended: {
    title: "Recommended for you",
    subtitle: "Picked from your wishlist and past orders.",
    ctaLabel: "",
    ctaHref: "",
    limit: 8,
  },
  whyChooseUs: {
    title: "Why choose Nutriyet",
    subtitle: "We obsess over quality so you can focus on feeling your best.",
    items: [
      { icon: "Leaf", title: "100% Natural", desc: "Clean-label products with no artificial preservatives." },
      { icon: "ShieldCheck", title: "Lab Tested", desc: "Every batch quality-checked for purity and nutrition." },
      { icon: "Truck", title: "Fast Delivery", desc: "Freshly packed and shipped with care across India." },
      { icon: "HeartPulse", title: "AI Nutrition Expert", desc: "Personalized guidance for what your body needs." },
    ],
  },
  testimonials: {
    title: "Loved by thousands",
    subtitle: "Real words from the Nutriyet community.",
    items: [
      { name: "Aisha K.", text: "The makhana is unbelievably fresh and crunchy. My go-to evening snack now!", rating: 5 },
      { name: "Rohan M.", text: "Loved the AI assistant — it suggested the perfect protein for my goals.", rating: 5 },
      { name: "Sneha P.", text: "Premium quality dry fruits at fair prices. Fast delivery too.", rating: 5 },
    ],
  },
};

export type SectionEditorKind =
  | "hero"
  | "aiBanner"
  | "heading"
  | "whyChooseUs"
  | "testimonials"
  | "none";

/** Which editor form (if any) a section uses. `none` = managed elsewhere. */
export const HOME_SECTION_EDITOR: Record<HomeSectionKey, SectionEditorKind> = {
  stories: "none",
  heroSlider: "none",
  hero: "hero",
  categories: "heading",
  featured: "heading",
  bestSellers: "heading",
  recommended: "heading",
  whyChooseUs: "whyChooseUs",
  testimonials: "testimonials",
  aiBanner: "aiBanner",
};

/** Lucide icon names selectable for "Why choose us" value props. */
export const VALUE_PROP_ICON_NAMES = [
  "Leaf",
  "ShieldCheck",
  "Truck",
  "HeartPulse",
  "Sparkles",
  "Star",
  "Award",
  "Heart",
  "PackageCheck",
  "Recycle",
] as const;
export type ValuePropIconName = (typeof VALUE_PROP_ICON_NAMES)[number];

/** Merge a stored content JSON over the section's defaults (shallow; arrays replace). */
export function resolveSectionContent<K extends HomeContentKey>(
  key: K,
  raw: unknown,
): HomeContentMap[K] {
  const def = HOME_CONTENT_DEFAULTS[key];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...def, ...(raw as Partial<HomeContentMap[K]>) };
  }
  return def;
}
