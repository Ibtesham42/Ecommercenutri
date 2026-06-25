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
