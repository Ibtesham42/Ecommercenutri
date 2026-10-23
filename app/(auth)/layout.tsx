import Link from "next/link";
import { ArrowLeft, Leaf, ShieldCheck, Sprout } from "lucide-react";
import { Logo } from "@/components/storefront/logo";
import { ShopThemeVars } from "@/components/storefront/shop-theme-vars";
import { SurfaceScope } from "@/components/storefront/surface-scope";
import { getStoreSettings } from "@/lib/queries/settings";

// The same promises the storefront trust strip makes — nothing invented here.
const PROMISES = [
  { icon: Leaf, label: "Freshly packed" },
  { icon: Sprout, label: "No artificial preservatives" },
  { icon: ShieldCheck, label: "Secure payments" },
];

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use the admin-configured website logo (Appearance settings) — never hardcoded.
  const settings = await getStoreSettings();
  const logoProps = {
    logoUrl: settings.logo,
    name: settings.siteName,
    height: settings.logoHeight,
    mobileHeight: settings.logoHeightMobile,
    maxWidth: settings.logoMaxWidth,
  };
  const year = new Date().getFullYear();

  return (
    // Same design scope as the storefront, so sign-in doesn't switch palettes mid-journey.
    <div
      data-surface="shop"
      className="min-h-dvh overflow-x-clip bg-background lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
    >
      <SurfaceScope />
      <ShopThemeVars settings={settings} />

      {/* Brand panel — desktop only; phones get straight to the form. */}
      <aside className="sticky top-0 hidden h-dvh flex-col justify-between bg-surface-deep p-12 text-surface-deep-foreground lg:flex xl:p-16">
        <Logo {...logoProps} className="self-start text-2xl" accentClassName="text-gold" onDark />

        <div className="max-w-md">
          <span className="block h-px w-10 bg-gold/70" aria-hidden />
          <p className="mt-7 font-heading text-[2.5rem] leading-[1.12] font-normal tracking-tight text-balance xl:text-[2.875rem]">
            Everyday nutrition, honestly made.
          </p>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-surface-deep-foreground/70">
            Makhana, dry fruits, seeds and wholesome snacks — picked for what they do for you,
            and delivered to your door.
          </p>
        </div>

        <div>
          <ul className="grid gap-3.5 border-t border-surface-deep-foreground/15 pt-7">
            {PROMISES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-surface-deep-foreground/80">
                <Icon className="size-4 text-gold" strokeWidth={1.75} aria-hidden />
                {label}
              </li>
            ))}
          </ul>
          <p className="mt-10 text-xs text-surface-deep-foreground/50">
            © {year} {settings.siteName}
          </p>
        </div>
      </aside>

      {/* Form column */}
      <div className="flex min-h-dvh flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8">
        <header className="flex h-12 items-center justify-between gap-4 lg:justify-end">
          <Logo {...logoProps} className="text-xl lg:hidden" />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span>
              Back<span className="max-sm:hidden"> to shop</span>
            </span>
          </Link>
        </header>

        <main className="flex flex-1 items-start justify-center pt-8 pb-10 sm:items-center sm:py-14">
          <div className="w-full max-w-[25rem]">{children}</div>
        </main>

        <p className="text-center text-xs text-muted-foreground lg:hidden">
          © {year} {settings.siteName}
        </p>
      </div>
    </div>
  );
}
