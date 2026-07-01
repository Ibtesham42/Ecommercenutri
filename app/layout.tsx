import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { organizationSchema, websiteSchema, jsonLd } from "@/lib/seo";
import { getStoreSettings } from "@/lib/queries/settings";
import { getSeoSettings } from "@/lib/seo-settings";
import { cldFavicon } from "@/lib/cld";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@/components/analytics";
import { SeoScripts, SeoNoscript } from "@/components/seo-scripts";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

// Body sans — Hanken Grotesque (clean, premium grocery/retail feel).
const fontSans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
// Headings — Fraunces, an editorial optical-sized serif for the premium voice.
// Loaded as a variable font (full weight range) with the optical-size axis.
const fontHeading = Fraunces({
  subsets: ["latin"],
  variable: "--font-heading",
  axes: ["opsz"],
});

export async function generateMetadata(): Promise<Metadata> {
  // All SEO is admin-editable (SEO & Social Share Manager + Appearance) and
  // resolved (with config fallback) by getSeoSettings(); favicon stays raw for
  // the multi-size icon set.
  const [store, seo] = await Promise.all([getStoreSettings(), getSeoSettings()]);
  const fav = store.favicon;

  const verificationOther: Record<string, string> = {};
  if (seo.bingVerification) verificationOther["msvalidate.01"] = seo.bingVerification;
  if (seo.pinterestVerification) verificationOther["p:domain_verify"] = seo.pinterestVerification;

  const other: Record<string, string> = {};
  if (seo.facebookAppId) other["fb:app_id"] = seo.facebookAppId;

  return {
    metadataBase: new URL(seo.siteUrl),
    title: {
      default: seo.title,
      template: `%s | ${seo.siteName}`,
    },
    description: seo.metaDescription,
    keywords: seo.keywords,
    applicationName: seo.siteName,
    authors: [{ name: seo.author, url: seo.siteUrl }],
    creator: seo.author,
    publisher: seo.publisher,
    category: seo.businessCategory,
    alternates: { canonical: seo.siteUrl },
    openGraph: {
      type: seo.ogType as "website",
      locale: seo.locale,
      url: seo.siteUrl,
      title: seo.shareTitle,
      description: seo.shareDescription,
      siteName: seo.siteName,
      images: [{ url: seo.shareImage }],
    },
    twitter: {
      card: seo.twitterCardType,
      title: seo.shareTitle,
      description: seo.shareDescription,
      images: [seo.twitterImage],
      ...(seo.twitterCreator ? { site: seo.twitterCreator, creator: seo.twitterCreator } : {}),
    },
    // Drive icons from the admin-uploaded favicon when set, else the generated
    // brand default. Favicons are normalized through Cloudinary (f_auto) so any
    // uploaded asset is delivered as a proper image, and the versioned URL
    // cache-busts the browser tab automatically. Supports .png/.ico/.svg.
    icons: {
      // Google Search needs a square PNG favicon at a multiple of 48px, served
      // as a real raster (not WebP/AVIF). `cldFavicon` forces PNG + square pad.
      icon: fav
        ? [
            { url: cldFavicon(fav, 48), sizes: "48x48", type: "image/png" },
            { url: cldFavicon(fav, 96), sizes: "96x96", type: "image/png" },
            { url: cldFavicon(fav, 192), sizes: "192x192", type: "image/png" },
          ]
        : [{ url: "/brand-icon", type: "image/png" }],
      shortcut: [fav ? cldFavicon(fav, 96) : "/brand-icon"],
      apple: seo.appleTouchIcon
        ? [{ url: seo.appleTouchIcon }]
        : fav
          ? [{ url: cldFavicon(fav, 180) }]
          : [{ url: "/brand-apple-icon" }],
    },
    verification: {
      ...(seo.googleVerification ? { google: seo.googleVerification } : {}),
      ...(seo.yandexVerification ? { yandex: seo.yandexVerification } : {}),
      ...(Object.keys(verificationOther).length ? { other: verificationOther } : {}),
    },
    ...(Object.keys(other).length ? { other } : {}),
    robots: seo.robotsIndex
      ? { index: true, follow: true }
      : { index: false, follow: false },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const seo = await getSeoSettings();
  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: seo.themeColor || "#ffffff" },
      { media: "(prefers-color-scheme: dark)", color: "#0f1a14" },
    ],
    width: "device-width",
    initialScale: 1,
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd(organizationSchema())}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd(websiteSchema())}
        />
      </head>
      <body
        className={cn(
          fontSans.variable,
          fontMono.variable,
          fontHeading.variable,
          "min-h-dvh bg-background font-sans antialiased",
        )}
      >
        <SeoNoscript />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
        {/* Project's pluggable (Plausible/Umami-style) analytics — env-gated. */}
        <Analytics />
        {/* Admin-managed analytics (GA4 / GTM / Meta Pixel) — each self-gates. */}
        <SeoScripts />
        {/* Vercel Web Analytics — production only; auto-tracks App Router page views. */}
        {process.env.NODE_ENV === "production" && <VercelAnalytics />}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
