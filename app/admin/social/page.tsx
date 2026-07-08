import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { getSocialOverview, getSocialProductOptions } from "@/lib/queries/social";
import { SocialActionBar } from "@/components/admin/social/social-action-bar";
import { InstagramConnectCard } from "@/components/admin/social/instagram-connect-card";
import { Badge } from "@/components/ui/badge";
import { PILLAR_LABEL } from "@/lib/social/strategy";
import { POST_STATUS_LABEL, POST_STATUS_VARIANT } from "@/lib/social/status";

export const metadata: Metadata = { title: "AI Marketing", robots: { index: false } };

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border p-4 shadow-elev-1">
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export default async function AdminSocialPage() {
  const [overview, products] = await Promise.all([
    getSocialOverview(),
    getSocialProductOptions(),
  ]);
  const { counts } = overview;

  return (
    <div>
      <PageHeader
        title="AI Marketing"
        description="Auto-generate and publish social content from your catalog."
      >
        <SocialActionBar products={products} />
      </PageHeader>

      {!overview.settings.enabled && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Automation is turned off. Posts won&apos;t be generated on schedule until you enable it in{" "}
          <span className="font-medium">Settings</span>.
        </div>
      )}
      {!overview.aiConfigured && (
        <div className="mb-4 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          AI isn&apos;t configured (no Groq key) — captions use a built-in template fallback.
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Active campaigns" value={overview.enabledCampaigns} />
        <Stat label="In queue" value={counts.DRAFT + counts.PENDING_APPROVAL} />
        <Stat label="Scheduled" value={counts.SCHEDULED} />
        <Stat label="Published" value={counts.PUBLISHED} />
        <Stat label="Failed" value={counts.FAILED} />
        <Stat label="Products promoted" value={overview.productsPromoted} />
      </div>

      {!overview.instagramConnected && (
        <div className="mb-6">
          <InstagramConnectCard />
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Recent activity</h2>
      {overview.recent.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No posts yet. Create a campaign, or use “Generate a post” to make your first draft.
        </div>
      ) : (
        <div className="grid gap-2">
          {overview.recent.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
              <Badge variant={POST_STATUS_VARIANT[p.status]}>{POST_STATUS_LABEL[p.status]}</Badge>
              <span className="min-w-0 flex-1 truncate">{p.hook || p.caption.split("\n")[0]}</span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {PILLAR_LABEL[p.pillar]}
                {p.productName ? ` · ${p.productName}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
