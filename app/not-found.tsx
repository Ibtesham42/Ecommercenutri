import type { Metadata } from "next";
import { Logo } from "@/components/storefront/logo";
import { NotFoundContent } from "@/components/storefront/not-found-content";
import { getStoreSettings } from "@/lib/queries/settings";

export const metadata: Metadata = { title: "Page not found" };

/**
 * Unmatched URLs. Next renders this from the root, outside every route group,
 * so there's no storefront header/footer here — the same standalone logo-on-
 * cream shell as the auth pages keeps it branded instead of the bare default.
 */
export default async function RootNotFound() {
  const settings = await getStoreSettings();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <Logo
        className="mb-10 text-2xl"
        logoUrl={settings.logo}
        name={settings.siteName}
        height={settings.logoHeight}
        mobileHeight={settings.logoHeightMobile}
        maxWidth={settings.logoMaxWidth}
      />
      <NotFoundContent />
    </div>
  );
}
