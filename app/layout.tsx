import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { organizationSchema, websiteSchema, jsonLd } from "@/lib/seo";
import { getStoreSettings } from "@/lib/queries/settings";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@/components/analytics";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

const fontSans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const fontHeading = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700", "800"],
});

export async function generateMetadata(): Promise<Metadata> {
  // SEO defaults are admin-editable (Appearance settings) with config fallback.
  const store = await getStoreSettings();
  const name = store.siteName;
  const title = store.metaTitle || `${name} — ${store.tagline}`;
  const description = store.metaDescription || siteConfig.description;
  const ogImages = store.ogImage ? [{ url: store.ogImage }] : undefined;

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: title,
      template: `%s | ${name}`,
    },
    description,
    keywords: [...siteConfig.keywords],
    applicationName: name,
    authors: [{ name, url: siteConfig.url }],
    creator: name,
    openGraph: {
      type: "website",
      locale: "en_IN",
      url: siteConfig.url,
      title,
      description,
      siteName: name,
      ...(ogImages ? { images: ogImages } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(store.ogImage ? { images: [store.ogImage] } : {}),
    },
    icons: store.favicon ? { icon: store.favicon } : { icon: "/favicon.ico" },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1a14" },
  ],
  width: "device-width",
  initialScale: 1,
};

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
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
        <Analytics />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
