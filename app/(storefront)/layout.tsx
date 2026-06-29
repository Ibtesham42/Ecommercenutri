import { SiteHeader } from "@/components/storefront/site-header";
import { SiteFooter } from "@/components/storefront/site-footer";
import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { WhatsAppButton } from "@/components/storefront/whatsapp-button";
import { AffiliateTracker } from "@/components/storefront/affiliate-tracker";
import { getStoreSettings } from "@/lib/queries/settings";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications, getUnreadCount } from "@/lib/queries/notifications";
import type { BellNotification } from "@/components/account/notification-bell";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getStoreSettings();

  // Notification bell (signed-in users). Best-effort — never blocks the layout.
  const user = await getCurrentUser();
  let notifications: BellNotification[] | undefined;
  let unreadCount = 0;
  if (user?.id) {
    const [list, unread] = await Promise.all([
      getNotifications(user.id),
      getUnreadCount(user.id),
    ]);
    notifications = list.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      link: n.link,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    }));
    unreadCount = unread;
  }

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
      <SiteHeader
        logoUrl={settings.logo}
        siteName={settings.siteName}
        logoHeight={settings.logoHeight}
        logoHeightMobile={settings.logoHeightMobile}
        logoMaxWidth={settings.logoMaxWidth}
        notifications={notifications}
        unreadCount={unreadCount}
      />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <WhatsAppButton number={settings.whatsapp} />
      <AffiliateTracker />
    </div>
  );
}
