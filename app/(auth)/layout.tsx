import { Logo } from "@/components/storefront/logo";
import { getStoreSettings } from "@/lib/queries/settings";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use the admin-configured website logo (Appearance settings) — never hardcoded.
  const settings = await getStoreSettings();
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-x-clip bg-gradient-to-b from-accent/40 to-background px-4 py-10 max-sm:px-5 max-sm:pb-[max(2.5rem,env(safe-area-inset-bottom))] max-sm:pt-[max(3rem,env(safe-area-inset-top))]">
      {/* Mobile-only ambient background: soft brand-green + warm-gold glows.
          Hidden at sm+ so the desktop pages look exactly as before. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 sm:hidden">
        <div className="absolute -right-20 -top-24 size-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -left-24 top-1/3 size-64 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-accent/60 to-transparent" />
      </div>
      <Logo
        className="mb-6 text-2xl max-sm:mb-8"
        logoUrl={settings.logo}
        name={settings.siteName}
        height={settings.logoHeight}
        mobileHeight={settings.logoHeightMobile}
        maxWidth={settings.logoMaxWidth}
      />
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-6 text-xs text-muted-foreground max-sm:mt-8">
        © {new Date().getFullYear()} {settings.siteName}
      </p>
    </div>
  );
}
