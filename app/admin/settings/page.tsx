import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, MinusCircle } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import {
  ChangeEmailForm,
  ChangePasswordForm,
} from "@/components/admin/account-forms";
import {
  StoreSettingsForm,
  type StoreSettingsValues,
} from "@/components/admin/store-settings-form";
import { siteConfig } from "@/config/site";
import { env, isConfigured } from "@/lib/env";
import { getAdminUser } from "@/lib/auth";
import { getStoreSettings } from "@/lib/queries/settings";

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

  const store = await getStoreSettings();
  const storeInitial: StoreSettingsValues = {
    supportEmail: store.supportEmail,
    supportPhone: store.supportPhone,
    address: store.address ?? "",
    announcement: store.announcement ?? "",
    instagram: store.instagram,
    facebook: store.facebook,
    twitter: store.twitter,
    youtube: store.youtube,
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Settings"
        description={isSuper ? "Your account, store details and integrations." : "Your account."}
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

        {/* Store settings — main admin only */}
        {isSuper && (
          <section className="rounded-xl border bg-background p-5">
            <h2 className="font-semibold">Store details</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Contact details and social links shown across the storefront. Blank
              fields fall back to the values in <code>config/site.ts</code>.
            </p>
            <div className="mt-4">
              <StoreSettingsForm initial={storeInitial} />
            </div>
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
