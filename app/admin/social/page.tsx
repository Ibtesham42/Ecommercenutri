import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { getSocialOverview, getSocialProductOptions } from "@/lib/queries/social";
import { SocialActionBar } from "@/components/admin/social/social-action-bar";
import { InstagramConnectCard } from "@/components/admin/social/instagram-connect-card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/admin/social/stat-card";
import { PILLAR_LABEL } from "@/lib/social/strategy";
import { POST_STATUS_LABEL, POST_STATUS_VARIANT } from "@/lib/social/status";
import {
  Megaphone,
  FileEdit,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Package,
} from "lucide-react";

export const metadata: Metadata = { title: "AI Marketing", robots: { index: false } };

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

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Campaigns" value={overview.enabledCampaigns} icon={Megaphone} hint="active" />
        <StatCard label="In queue" value={counts.DRAFT + counts.PENDING_APPROVAL} icon={FileEdit} hint="drafts + approvals" />
        <StatCard label="Scheduled" value={counts.SCHEDULED} icon={CalendarClock} />
        <StatCard label="Published" value={counts.PUBLISHED} icon={CheckCircle2} />
        <StatCard label="Failed" value={counts.FAILED} icon={AlertTriangle} />
        <StatCard label="Promoted" value={overview.productsPromoted} icon={Package} hint="products" />
      </div>

      {!overview.instagramConnected && (
        <div className="mb-6">
          <InstagramConnectCard />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-elev-1">
        <div className="border-b px-4 py-2.5 text-sm font-semibold">Recent activity</div>
        {overview.recent.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No posts yet. Create a campaign, or use “Generate a post” to make your first draft.
          </div>
        ) : (
          <ul className="divide-y">
            {overview.recent.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40">
                <Badge variant={POST_STATUS_VARIANT[p.status]} className="shrink-0">
                  {POST_STATUS_LABEL[p.status]}
                </Badge>
                <span className="min-w-0 flex-1 truncate">{p.hook || p.caption.split("\n")[0]}</span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {PILLAR_LABEL[p.pillar]}
                  {p.productName ? ` · ${p.productName}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
