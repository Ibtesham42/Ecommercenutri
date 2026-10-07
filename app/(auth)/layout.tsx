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
    <div className="flex min-h-dvh flex-col items-center justify-center overflow-x-clip bg-background px-4 py-10 max-sm:px-5 max-sm:pb-[max(2.5rem,env(safe-area-inset-bottom))] max-sm:pt-[max(3rem,env(safe-area-inset-top))]">
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
