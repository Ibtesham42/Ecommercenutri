import { Camera, ExternalLink } from "lucide-react";

/**
 * Setup guidance shown when Instagram isn't configured yet. Mirrors the
 * Marketing Hub's PushSetupCard: the feature still works (drafts + mock publish),
 * this just explains how to enable real publishing. Purely informational.
 */
export function InstagramConnectCard() {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 p-4">
      <div className="flex items-center gap-2 font-medium">
        <Camera className="size-4 text-primary" />
        Connect Instagram to publish for real
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Until Instagram is connected, posts are generated and queued, and publishing
        is simulated (marked published with a mock id) so you can try the full flow.
        To publish for real, set these environment variables on your deployment:
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        <li>
          <code className="rounded bg-muted px-1">INSTAGRAM_ACCESS_TOKEN</code> — a
          long-lived token for an Instagram Business/Creator account linked to a
          Facebook Page
        </li>
        <li>
          <code className="rounded bg-muted px-1">INSTAGRAM_BUSINESS_ID</code> — the
          IG user id (from the Graph API)
        </li>
        <li>
          <code className="rounded bg-muted px-1">CRON_SECRET</code> +{" "}
          <code className="rounded bg-muted px-1">SITE_URL</code> as GitHub repo
          secrets so the scheduler can run with your laptop off
        </li>
      </ul>
      <a
        href="https://developers.facebook.com/docs/instagram-platform/content-publishing"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        Meta Content Publishing docs <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
