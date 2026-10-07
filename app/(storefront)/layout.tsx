import { SiteHeader } from "@/components/storefront/site-header";
import { SurfaceScope } from "@/components/storefront/surface-scope";
import { SiteFooter } from "@/components/storefront/site-footer";
import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { WhatsAppButton } from "@/components/storefront/whatsapp-button";
import { MobileBottomNav } from "@/components/storefront/mobile-bottom-nav";
import { AffiliateTracker } from "@/components/storefront/affiliate-tracker";
import { VisitTracker } from "@/components/storefront/visit-tracker";
import { JourneyTracker } from "@/components/storefront/journey-tracker";
import { EngagementTracker } from "@/components/storefront/engagement-tracker";
import { PwaInstallPrompt } from "@/components/storefront/pwa-install-prompt";
import { OfferBar } from "@/components/storefront/growth/offer-bar";
import { WelcomePopup } from "@/components/storefront/growth/welcome-popup";
import { getStoreSettings } from "@/lib/queries/settings";
import { getCategoryTree } from "@/lib/queries/catalog";
import { getPwaSettings } from "@/lib/pwa-settings";
import { getGrowthSettings } from "@/lib/growth-settings";
import { env, isConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications, getUnreadCount } from "@/lib/queries/notifications";
import type { BellNotification } from "@/components/account/notification-bell";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, pwa, growth, categoryTree] = await Promise.all([
    getStoreSettings(),
    getPwaSettings(),
    getGrowthSettings(),
    getCategoryTree(),
  ]);

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
    // data-surface="shop" scopes the editorial storefront design system
    // (globals.css); <SurfaceScope> mirrors it onto <html> for portals.
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
      {growth.stickyBarEnabled && <OfferBar text={growth.stickyText} />}
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
      <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
      <SiteFooter />
      {/* WhatsApp floats on desktop only; mobile uses the bottom tab bar. */}
      <div className="hidden md:block">
        <WhatsAppButton number={settings.whatsapp} />
      </div>
      <MobileBottomNav isLoggedIn={!!user} />
      <AffiliateTracker />
      <VisitTracker />
      <JourneyTracker />
      <EngagementTracker />
      <PwaInstallPrompt
        settings={pwa}
        vapidPublicKey={isConfigured.webPush() ? env.vapidPublicKey : ""}
        signedIn={!!user}
        logoUrl={settings.logo}
      />
      {growth.welcomePopupEnabled && (
        <WelcomePopup
          isLoggedIn={!!user}
          title={growth.popupTitle}
          subtitle={growth.popupSubtitle}
          couponPercent={growth.couponPercent}
        />
      )}
    </div>
  );
}
