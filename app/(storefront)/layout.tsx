import { SiteHeader } from "@/components/storefront/site-header";
import { SiteFooter } from "@/components/storefront/site-footer";
import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { WhatsAppButton } from "@/components/storefront/whatsapp-button";
import { getStoreSettings } from "@/lib/queries/settings";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getStoreSettings();

  // Admin-chosen theme colors override the brand palette across the storefront.
  const themeVars = [
    settings.primaryColor && `--primary:${settings.primaryColor};--ring:${settings.primaryColor};`,
    settings.secondaryColor && `--secondary:${settings.secondaryColor};`,
  ]
    .filter(Boolean)
    .join("");

  return (
    <div className="flex min-h-dvh flex-col">
      {themeVars && (
        <style dangerouslySetInnerHTML={{ __html: `:root,.dark{${themeVars}}` }} />
      )}
      <AnnouncementBar
        active={settings.announcementActive}
        message={settings.announcement}
        link={settings.announcementLink}
      />
      <SiteHeader logoUrl={settings.logo} siteName={settings.siteName} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <WhatsAppButton number={settings.whatsapp} />
    </div>
  );
}
