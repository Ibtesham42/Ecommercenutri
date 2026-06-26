import { Logo } from "@/components/storefront/logo";
import { siteConfig } from "@/config/site";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-accent/40 to-background px-4 py-10">
      <Logo className="mb-6 text-2xl" />
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-6 text-xs text-muted-foreground">
        © {new Date().getFullYear()} {siteConfig.name}
      </p>
    </div>
  );
}
