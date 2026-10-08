import { SiteHeader } from "@/components/storefront/site-header";
import { SurfaceScope } from "@/components/storefront/surface-scope";
import { SiteFooter } from "@/components/storefront/site-footer";
import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { WhatsAppButton } from "@/components/storefront/whatsapp-button";
import { MobileBottomNav } from "@/components/storefront/mobile-bottom-nav";
import { UtilityBar } from "@/components/storefront/utility-bar";
import { getStoreSettings } from "@/lib/queries/settings";
import { getCategoryTree } from "@/lib/queries/catalog";
import { getGrowthSettings } from "@/lib/growth-settings";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications, getUnreadCount } from "@/lib/queries/notifications";
import type { BellNotification } from "@/components/account/notification-bell";

/** Everything the shop chrome needs, fetched once per layout render. */
export async function getChromeData() {
  const [settings, growth, categoryTree, user] = await Promise.all([
    getStoreSettings(),
    getGrowthSettings(),
    getCategoryTree(),
    getCurrentUser(),
  ]);

  // Notification bell (signed-in users). Best-effort — never blocks the layout.
  let notifications: BellNotification[] | undefined;
  let unreadCount = 0;
  if (user?.id) {
    const [list, unread] = await Promise.all([getNotifications(user.id), getUnreadCount(user.id)]);
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

  return { settings, growth, categoryTree, user, notifications, unreadCount };
}

export type ChromeData = Awaited<ReturnType<typeof getChromeData>>;

/**
 * The customer-facing frame shared by the storefront and account layouts:
 * the editorial design scope (`data-surface="shop"`, mirrored onto <html> for
 * portals), admin theme colours, utility/announcement bars, header, footer,
 * WhatsApp and the mobile tab bar. Page-type extras (analytics trackers, PWA
 * prompt, welcome popup) are passed by the storefront layout as `extras`.
 */
export function StorefrontChrome({
  data: { settings, growth, categoryTree, user, notifications, unreadCount },
  extras,
  children,
}: {
  data: ChromeData;
  extras?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Admin-chosen theme colors override the brand palette across the storefront.
  const themeVars = [
    settings.primaryColor && `--primary:${settings.primaryColor};--ring:${settings.primaryColor};`,
    settings.secondaryColor && `--secondary:${settings.secondaryColor};`,
  ]
    .filter(Boolean)
    .join("");

  return (
    <div data-surface="shop" className="flex min-h-dvh flex-col">
      <SurfaceScope />
      {themeVars && (
        // Also target the scope, or its own --primary would beat the admin's choice.
        <style
          dangerouslySetInnerHTML={{
            __html: `:root,.dark,[data-surface="shop"],.dark[data-surface="shop"],.dark [data-surface="shop"]{${themeVars}}`,
          }}
        />
      )}
      <UtilityBar
        offerText={growth.stickyBarEnabled ? growth.stickyText : null}
        freeShippingThreshold={settings.freeShippingThreshold}
        freeShippingEnabled={settings.freeShippingEnabled}
      />
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
        isLoggedIn={!!user}
        categories={categoryTree}
        freeShippingThreshold={settings.freeShippingThreshold}
        freeShippingEnabled={settings.freeShippingEnabled}
      />
      {/* Bottom padding on mobile clears the fixed bottom tab bar (its 4rem
          height + the iPhone safe-area inset). Removed on md+ (no bottom bar). */}
      <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
      <SiteFooter />
      {/* WhatsApp floats on desktop only; mobile uses the bottom tab bar. */}
      <div className="hidden md:block">
        <WhatsAppButton number={settings.whatsapp} />
      </div>
      <MobileBottomNav isLoggedIn={!!user} />
      {extras}
    </div>
  );
}
