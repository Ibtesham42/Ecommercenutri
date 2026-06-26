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
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-accent/40 to-background px-4 py-10">
      <Logo
        className="mb-6 text-2xl"
        logoUrl={settings.logo}
        name={settings.siteName}
        height={settings.logoHeight}
        mobileHeight={settings.logoHeightMobile}
        maxWidth={settings.logoMaxWidth}
      />
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-6 text-xs text-muted-foreground">
        © {new Date().getFullYear()} {settings.siteName}
      </p>
    </div>
  );
}
