import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getStoreSettings } from "@/lib/queries/settings";
import { SiteHeader } from "@/components/storefront/site-header";
import { SiteFooter } from "@/components/storefront/site-footer";
import { AccountSidebar } from "@/components/account/account-sidebar";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, settings] = await Promise.all([getCurrentUser(), getStoreSettings()]);
  if (!user) redirect("/login?callbackUrl=/account");

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        logoUrl={settings.logo}
        siteName={settings.siteName}
        logoHeight={settings.logoHeight}
        logoHeightMobile={settings.logoHeightMobile}
        logoMaxWidth={settings.logoMaxWidth}
        isLoggedIn
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8">
        <h1 className="mb-4 text-2xl font-bold sm:mb-6 sm:text-3xl">My account</h1>
        {/* grid-cols-1 / minmax(0,1fr) give an explicit, width-constrained track
            (Tailwind's grid-cols-* use minmax(0,1fr)); without it the implicit
            auto track grows to fit the horizontal nav rail and overflows the page
            on mobile. The rail then scrolls inside its column instead. */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[240px_minmax(0,1fr)] md:gap-8">
          {/* Mobile: a clean full-bleed horizontal nav bar (native-app feel).
              Desktop: a sticky card sidebar. `min-w-0` lets the horizontal nav
              rail scroll internally instead of forcing the page wider. */}
          <aside className="-mx-4 min-w-0 md:mx-0">
            <div className="min-w-0 border-y bg-card px-2 py-2 md:sticky md:top-24 md:rounded-2xl md:border md:shadow-elev-1">
              <AccountSidebar />
            </div>
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
