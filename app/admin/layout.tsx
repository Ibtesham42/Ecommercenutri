import { redirect } from "next/navigation";
import Link from "next/link";
import { Store } from "lucide-react";
import { getAdminUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import {
  AdminNav,
  AdminMobileNav,
  type AdminNavAccess,
} from "@/components/admin/admin-nav";
import { AdminPageTransition } from "@/components/admin/admin-page-transition";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getStoreSettings } from "@/lib/queries/settings";
import { cldUrl } from "@/lib/cld";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fresh role + permissions from the DB (not the possibly-stale session).
  const admin = await getAdminUser();
  if (!admin) redirect("/login?callbackUrl=/admin");

  const store = await getStoreSettings();
  const access: AdminNavAccess = {
    isSuperAdmin: admin.role === "SUPER_ADMIN",
    permissions: admin.permissions,
  };

  return (
    <div className="min-h-dvh bg-muted/20">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 shadow-elev-1 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <AdminMobileNav access={access} />
        <Link
          href="/admin"
          className="flex items-center gap-2 font-bold transition-opacity hover:opacity-80"
        >
          {store.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cldUrl(store.logo, { h: 56 })}
              alt={store.siteName}
              className="h-7 w-auto max-w-[140px] object-contain"
            />
          ) : (
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
              N
            </span>
          )}
          <span className="hidden text-sm text-muted-foreground sm:inline">Admin</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href="/" target="_blank">
              <Store className="size-4" /> <span className="hidden sm:inline">View store</span>
            </Link>
          </Button>
          <ThemeToggle />
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px]">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r bg-background p-3 lg:block">
          <AdminNav access={access} />
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <AdminPageTransition>{children}</AdminPageTransition>
        </main>
      </div>
    </div>
  );
}
