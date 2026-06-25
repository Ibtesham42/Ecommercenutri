import type { Metadata } from "next";
import { CheckCircle2, MinusCircle } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { env, isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default function AdminSettingsPage() {
  const integrations: { name: string; ready: boolean; note: string }[] = [
    { name: "Database (Neon)", ready: Boolean(env.databaseUrl), note: "PostgreSQL" },
    { name: "Google OAuth", ready: isConfigured.google(), note: "Social login" },
    { name: "Resend (email)", ready: isConfigured.resend(), note: "Transactional email" },
    { name: "Razorpay", ready: isConfigured.razorpay(), note: "Payments" },
    { name: "Cloudinary", ready: isConfigured.cloudinary(), note: "Media uploads" },
    { name: "Groq AI", ready: isConfigured.groq(), note: "AI features" },
    { name: "Upstash Redis", ready: isConfigured.redis(), note: "Cache + rate limit" },
  ];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Settings"
        description="Store information and integration status."
      />

      <div className="space-y-6">
        <section className="rounded-xl border bg-background p-5">
          <h2 className="font-semibold">Store</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{siteConfig.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Domain</dt>
              <dd className="font-medium">{siteConfig.domain}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Support email</dt>
              <dd className="font-medium">{siteConfig.contact.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Support phone</dt>
              <dd className="font-medium">{siteConfig.contact.phone}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Store identity is configured in <code>config/site.ts</code>. Secrets and
            URLs come from environment variables.
          </p>
        </section>

        <section className="rounded-xl border bg-background p-5">
          <h2 className="font-semibold">Integrations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each integration has a graceful fallback, so the store runs even when an
            integration is not yet configured.
          </p>
          <ul className="mt-4 divide-y">
            {integrations.map((i) => (
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
        </section>
      </div>
    </div>
  );
}
