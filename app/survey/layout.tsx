import { Logo } from "@/components/storefront/logo";
import { getStoreSettings } from "@/lib/queries/settings";

/**
 * Standalone branded shell for the public survey — Nutriyet logo + soft brand
 * background, deliberately OUTSIDE the storefront route group so there is no
 * header/footer/nav. The page is link-only: nothing on the site links here.
 */
export default async function SurveyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getStoreSettings();
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center overflow-x-clip bg-gradient-to-b from-accent/40 to-background px-4 py-8 max-sm:px-4 max-sm:pt-[max(2rem,env(safe-area-inset-top))]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-20 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -left-24 top-1/3 size-64 rounded-full bg-gold/10 blur-3xl" />
      </div>
      <Logo
        className="mb-6 text-2xl"
        logoUrl={settings.logo}
        name={settings.siteName}
        height={settings.logoHeight}
        mobileHeight={settings.logoHeightMobile}
        maxWidth={settings.logoMaxWidth}
      />
      <div className="w-full max-w-2xl">{children}</div>
      <p className="mt-8 pb-4 text-center text-xs text-muted-foreground">
        Powered by NutriYet – Nutrient. And Beyond!
      </p>
    </div>
  );
}
