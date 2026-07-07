import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

type BuildMetadataArgs = {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noindex?: boolean;
  keywords?: string[];
};

/** Build per-page Metadata consistent with the site defaults. */
export function buildMetadata({
  title,
  description,
  path = "/",
  image,
  noindex,
  keywords,
}: BuildMetadataArgs = {}): Metadata {
  const url = new URL(path, siteConfig.url).toString();
  const desc = description ?? siteConfig.description;
  const ogImage = image ?? siteConfig.ogImage;

  return {
    title,
    description: desc,
    keywords: keywords ?? [...siteConfig.keywords],
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: title ?? `${siteConfig.name} — ${siteConfig.tagline}`,
      description: desc,
      siteName: siteConfig.name,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title: title ?? `${siteConfig.name} — ${siteConfig.tagline}`,
      description: desc,
      images: [ogImage],
    },
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
  };
}

/** Render a JSON-LD <script> payload object. */
export function jsonLd(data: Record<string, unknown>) {
  return {
    __html: JSON.stringify(data),
  };
}

/** Organization schema for brand knowledge-panel eligibility. */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: new URL(siteConfig.ogImage, siteConfig.url).toString(),
    description: siteConfig.description,
    email: siteConfig.contact.email,
    sameAs: Object.values(siteConfig.social),
  };
}

/** WebSite schema with a sitelinks search box pointing at /search. */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteConfig.url}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * ItemList schema for a collection/category page — helps Google understand the
 * product listing (list rich results, product discovery). Summary-page form:
 * each element is a positioned link to the product's detail page.
 */
export function itemListSchema(
  items: { name: string; path: string; image?: string }[],
  name?: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    ...(name ? { name } : {}),
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: new URL(item.path, siteConfig.url).toString(),
      ...(item.image ? { image: item.image } : {}),
    })),
  };
}

/** BreadcrumbList schema from ordered { name, path } crumbs. */
export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: new URL(item.path, siteConfig.url).toString(),
    })),
  };
}
