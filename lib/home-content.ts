import type {
  HeroContent,
  AiBannerContent,
  HeadingContent,
  WhyChooseUsContent,
  TestimonialsContent,
  CombosContent,
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
  deals: HeadingContent;
  recommended: HeadingContent;
  trending: HeadingContent;
  combos: CombosContent;
  whyChooseUs: WhyChooseUsContent;
  testimonials: TestimonialsContent;
};

// Code defaults follow the brand's website-structure doc and its claim-safety
// rules: no blanket purity/preservative claims, no health or treatment
// promises, no invented stats or quotes. Admin edits (stored JSON) win.
export const HOME_CONTENT_DEFAULTS: HomeContentMap = {
  hero: {
    eyebrow: "From the heart of Mithila",
    title: "Rooted in tradition.",
    highlight: "Made for today.",
    description:
      "Authentic Indian foods made with carefully selected ingredients and thoughtful processing — prepared with care and delivered to your home.",
    primaryLabel: "Shop now",
    primaryHref: "/products",
    secondaryLabel: "Discover our story",
    secondaryHref: "/about",
    stats: [],
    bgColor: null,
    textColor: null,
  },
  aiBanner: {
    eyebrow: "Nutriyet assistant",
    title: "Not sure where to start? Ask us anything about our food.",
    description:
      "What is makhana? How do I use moringa powder? Which pack suits my kitchen? Get quick answers drawn from our own catalogue.",
    ctaLabel: "Ask a question",
    ctaHref: "/assistant",
    bgColor: null,
    textColor: null,
  },
  categories: {
    title: "Shop by category",
    subtitle: "Makhana, desi spices and everyday staples.",
    ctaLabel: "View all",
    ctaHref: "/categories",
    limit: 6,
  },
  featured: {
    title: "Nutriyet favourites",
    subtitle: "",
    ctaLabel: "Shop all products",
    ctaHref: "/products",
    limit: 8,
  },
  bestSellers: {
    title: "Best sellers",
    subtitle: "What our customers order most.",
    ctaLabel: "View all",
    ctaHref: "/products?sort=best-sellers",
    limit: 8,
  },
  deals: {
    title: "Current offers",
    subtitle: "Genuine discounts on selected products.",
    ctaLabel: "View all offers",
    ctaHref: "/offers",
    limit: 8,
  },
  recommended: {
    title: "Picked for you",
    subtitle: "Based on what you've viewed, saved and ordered.",
    ctaLabel: "",
    ctaHref: "",
    limit: 8,
  },
  trending: {
    title: "Popular this week",
    subtitle: "",
    ctaLabel: "",
    ctaHref: "",
    limit: 8,
  },
  combos: {
    title: "Shop by kitchen moment",
    subtitle: "A few of our products, grouped by how they're used.",
    ctaLabel: "",
    ctaHref: "",
    limit: 4,
    items: [
      {
        key: "snacking",
        title: "Tea-time snacking",
        description: "Roasted and flavoured makhana",
        match: ["makhana"],
      },
      {
        key: "spice-box",
        title: "The everyday spice box",
        description: "Desi spices and seasonings",
        match: ["spice", "masala", "seasoning"],
      },
      {
        key: "greens",
        title: "Greens for the pantry",
        description: "Moringa and green powders",
        match: ["moringa", "green"],
      },
      {
        key: "flours",
        title: "Flours and atta",
        description: "Multigrain and whole wheat",
        match: ["atta", "flour", "sattu"],
      },
    ],
  },
  whyChooseUs: {
    title: "Why Nutriyet",
    subtitle: "Not just food. Food with a story.",
    items: [
      {
        icon: "Leaf",
        title: "Authentic ingredients",
        desc: "We choose ingredients that keep their natural character, taste and aroma.",
      },
      {
        icon: "Award",
        title: "Thoughtful processing",
        desc: "Each category needs a different approach, so we pick the right one for every product.",
      },
      {
        icon: "PackageCheck",
        title: "Honest information",
        desc: "Clear labels and product details, so you know exactly what you're buying.",
      },
      {
        icon: "Heart",
        title: "Customer-first care",
        desc: "We're here before, during and after your order.",
      },
    ],
  },
  testimonials: {
    // The section shows genuine approved reviews only (HomeTestimonials);
    // these items are legacy and never rendered.
    title: "From our customers",
    subtitle: "Reviews left by customers on nutriyet.in.",
    items: [],
  },
};

export type SectionEditorKind =
  | "hero"
  | "aiBanner"
  | "heading"
  | "whyChooseUs"
  | "testimonials"
  | "combos"
  | "none";

/** Which editor form (if any) a section uses. `none` = managed elsewhere. */
export const HOME_SECTION_EDITOR: Record<HomeSectionKey, SectionEditorKind> = {
  stories: "none",
  heroSlider: "none",
  hero: "hero",
  categories: "heading",
  featured: "heading",
  bestSellers: "heading",
  deals: "heading",
  recommended: "heading",
  trending: "heading",
  combos: "combos",
  whyChooseUs: "whyChooseUs",
  testimonials: "testimonials",
  aiBanner: "aiBanner",
  story: "none",
  journal: "none",
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
