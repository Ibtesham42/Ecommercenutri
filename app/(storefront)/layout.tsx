import { StorefrontChrome, getChromeData } from "@/components/storefront/storefront-chrome";
import { AffiliateTracker } from "@/components/storefront/affiliate-tracker";
import { VisitTracker } from "@/components/storefront/visit-tracker";
import { JourneyTracker } from "@/components/storefront/journey-tracker";
import { EngagementTracker } from "@/components/storefront/engagement-tracker";
import { PwaInstallPrompt } from "@/components/storefront/pwa-install-prompt";
import { WelcomePopup } from "@/components/storefront/growth/welcome-popup";
import { env, isConfigured } from "@/lib/env";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const chrome = await getChromeData();
  const { growth, user } = chrome;

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
            vapidPublicKey={isConfigured.webPush() ? env.vapidPublicKey : ""}
            signedIn={!!user}
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
