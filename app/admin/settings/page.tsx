import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, MinusCircle, Palette, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChangeEmailForm,
  ChangePasswordForm,
} from "@/components/admin/account-forms";
import { siteConfig } from "@/config/site";
import { env, isConfigured } from "@/lib/env";
import { getAdminUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

const integrations = (): { name: string; ready: boolean; note: string }[] => [
  { name: "Database (Neon)", ready: Boolean(env.databaseUrl), note: "PostgreSQL" },
  { name: "Google OAuth", ready: isConfigured.google(), note: "Social login" },
  { name: "Resend (email)", ready: isConfigured.resend(), note: "Transactional email" },
  { name: "Razorpay", ready: isConfigured.razorpay(), note: "Payments" },
  { name: "Cloudinary", ready: isConfigured.cloudinary(), note: "Media uploads" },
  { name: "Groq AI", ready: isConfigured.groq(), note: "AI features" },
  { name: "Upstash Redis", ready: isConfigured.redis(), note: "Cache + rate limit" },
];

export default async function AdminSettingsPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin");
  const isSuper = admin.role === "SUPER_ADMIN";
  const canAppearance =
    isSuper || admin.permissions.includes("appearance");

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Settings"
        description={isSuper ? "Your account and integrations." : "Your account."}
      />

      <div className="space-y-6">
        {/* My account — available to every admin */}
        <section className="rounded-xl border bg-background p-5">
          <h2 className="font-semibold">My account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your own login email and password.
          </p>
          <div className="mt-4 grid gap-8 lg:grid-cols-2">
            <ChangeEmailForm currentEmail={admin.email} />
            <ChangePasswordForm />
          </div>
        </section>

        {/* Store appearance — managed on its own page */}
        {canAppearance && (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-background p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Palette className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">Appearance &amp; branding</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Logo, theme colors, announcement bar, contact details, social links
                  and SEO defaults.
                </p>
              </div>
            </div>
            <Button asChild className="gap-1.5">
              <Link href="/admin/appearance">
                Manage appearance <ArrowRight className="size-4" />
              </Link>
            </Button>
          </section>
        )}

        {/* Integrations — main admin only */}
        {isSuper && (
          <section className="rounded-xl border bg-background p-5">
            <h2 className="font-semibold">Integrations</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each integration has a graceful fallback, so the store runs even when
              one is not yet configured.
            </p>
            <ul className="mt-4 divide-y">
              {integrations().map((i) => (
                <li key={i.name} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    {i.ready ? (
                      <CheckCircle2 className="size-5 text-primary" />
                    ) : (
                      <MinusCircle className="size-5 text-muted-foreground/50" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{i.name}</p>
                      <p className="text-xs text-muted-foreground">{i.note}</p>
                    </div>
                  </div>
                  <Badge variant={i.ready ? "default" : "secondary"}>
                    {i.ready ? "Configured" : "Fallback"}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Store: {siteConfig.name} · {siteConfig.domain}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
