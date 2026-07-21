import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import Link from "next/link";
import "./presentation.css";
import { JnvPresentationProvider } from "@/components/jnv/presentation-provider";
import { JnvPresentationControls } from "@/components/jnv/presentation-controls";
import { JnvAiContextProvider } from "@/components/jnv/ai-context-provider";
import { JnvAiLauncher } from "@/components/jnv/jnv-ai-launcher";

// Isolated academic identity — a blue/emerald favicon so the browser tab never
// shows the Nutriyet mark for this module (inline SVG, no external asset).
const JNV_ICON_SVG =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#1d4ed8"/>
      <path d="M12 6 4 9.5 12 13l6.5-3-2-.87M12 13v5M6 11.2V15c0 1.5 2.7 3 6 3s6-1.5 6-3v-3.8" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  );

// This module is deliberately unlisted: no storefront nav link, sitemap entry,
// or search visibility — only reachable via direct URL — but pages are also
// marked noindex/nofollow so a stray backlink can't surface them in results.
const JNV_DESCRIPTION = "Digital classroom resources for Jawahar Navodaya Vidyalaya Smart Classes.";

export const metadata: Metadata = {
  title: { default: "JNV Smart Class", template: "%s | JNV Smart Class" },
  description: JNV_DESCRIPTION,
  applicationName: "JNV Smart Class",
  authors: [],
  creator: "",
  publisher: "",
  robots: { index: false, follow: false, nocache: true },
  icons: { icon: JNV_ICON_SVG },
  // Isolated share/browser identity — without these, pages inherit the root
  // layout's Nutriyet OG/Twitter cards and title (its title.template only
  // covers this segment's own descendants, not this same-segment page.tsx).
  openGraph: {
    title: "JNV Smart Class",
    description: JNV_DESCRIPTION,
    siteName: "JNV Smart Class",
    images: [],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "JNV Smart Class",
    description: JNV_DESCRIPTION,
    images: [],
  },
};

/**
 * Fully isolated shell for the JNV Smart Class module — its own header/footer,
 * academic blue/emerald palette, no Nutriyet branding or storefront chrome.
 * Sits as a sibling of (storefront)/(account)/admin so it never inherits the
 * ecommerce header/footer/nav.
 */
export default function JnvLayout({ children }: { children: React.ReactNode }) {
  return (
    <JnvPresentationProvider>
    <JnvAiContextProvider>
      <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <header className="jnv-chrome sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 print:hidden">
          <div className="jnv-container mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8 2xl:max-w-[1760px] 2xl:px-12">
            <Link href="/jnv" className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
                <GraduationCap className="size-5" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-base font-bold tracking-tight sm:text-lg">JNV Smart Class</span>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  Digital Classroom Portal
                </span>
              </span>
            </Link>
            <Link
              href="/jnv/search"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:text-blue-300"
            >
              Search
            </Link>
          </div>
        </header>

        <main className="jnv-main flex-1">{children}</main>

        <footer className="jnv-chrome border-t border-slate-200 py-6 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500 print:hidden">
          JNV Smart Class Portal — for classroom &amp; smart board use, Classes 6–10.
        </footer>
      </div>

      <JnvPresentationControls />
      <JnvAiLauncher />
    </JnvAiContextProvider>
    </JnvPresentationProvider>
  );
}
