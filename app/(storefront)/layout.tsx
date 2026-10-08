import { StorefrontChrome, getChromeData } from "@/components/storefront/storefront-chrome";
import { AffiliateTracker } from "@/components/storefront/affiliate-tracker";
import { VisitTracker } from "@/components/storefront/visit-tracker";
import { JourneyTracker } from "@/components/storefront/journey-tracker";
import { EngagementTracker } from "@/components/storefront/engagement-tracker";
import { PwaInstallPrompt } from "@/components/storefront/pwa-install-prompt";
import { WelcomePopup } from "@/components/storefront/growth/welcome-popup";
import { getPwaSettings } from "@/lib/pwa-settings";
import { env, isConfigured } from "@/lib/env";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [chrome, pwa] = await Promise.all([getChromeData(), getPwaSettings()]);
  const { settings, growth, user } = chrome;

  return (
    <StorefrontChrome
      data={chrome}
      extras={
        <>
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
        </>
      }
    >
      {children}
    </StorefrontChrome>
  );
}
