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
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold sm:text-3xl">My account</h1>
        <div className="grid gap-6 md:grid-cols-[240px_1fr] md:gap-8">
          <aside>
            <div className="rounded-2xl border bg-card p-2 shadow-elev-1 md:sticky md:top-24">
              <AccountSidebar />
            </div>
          </aside>
          <div>{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
