import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StorefrontChrome, getChromeData } from "@/components/storefront/storefront-chrome";
import { AccountSidebar, AccountTitle } from "@/components/account/account-sidebar";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const chrome = await getChromeData();
  if (!chrome.user) redirect("/login?callbackUrl=/account");
  // Read the name from the DB, not the JWT: a profile edit must show at once.
  const profile = await prisma.user.findUnique({ where: { id: chrome.user.id }, select: { name: true } });
  const firstName = profile?.name?.trim().split(/\s+/)[0];

  // Same shop chrome and editorial surface as the storefront, without its
  // analytics trackers or growth popups.
  return (
    <StorefrontChrome data={chrome}>
      <div className="shop-container pt-6 pb-20 sm:pt-8 lg:pb-28">
        <header>
          <p className="eyebrow">My account</p>
          <AccountTitle firstName={firstName} />
        </header>
        {/* grid-cols-1 / minmax(0,1fr) give an explicit, width-constrained track;
            without it the implicit auto track grows to fit the horizontal nav
            rail and overflows the page on mobile. The rail scrolls inside it. */}
        <div className="mt-6 grid grid-cols-1 gap-6 sm:mt-8 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
          <aside className="-mx-4 min-w-0 border-b border-border px-1 sm:-mx-6 sm:px-3 md:mx-0 md:border-b-0 md:px-0">
            <div className="md:sticky md:top-28">
              <AccountSidebar />
            </div>
          </aside>
          {/* 44px fields everywhere here; on touch screens also 44px text
              buttons (the account UI uses compact `sm` buttons for mouse). */}
          <div className="shop-form min-w-0 pointer-coarse:[&_[data-slot=button]:not([data-size^=icon])]:min-h-11">
            {children}
          </div>
        </div>
      </div>
    </StorefrontChrome>
  );
}
