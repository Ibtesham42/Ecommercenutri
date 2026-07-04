import { Video } from "lucide-react";
import type { ReplaySummary } from "@/lib/queries/engagement";
import { ReplayPanel } from "@/components/admin/insights/replay-panel";

/**
 * Session Replay — anonymized shopper sessions (sampled). Recordings contain
 * only normalized cursor/scroll/click coordinates and page paths — never DOM
 * content, typed text or personal data — so there is nothing sensitive to
 * mask by construction. 30-day retention, pruned automatically.
 */
export function ReplaySection({ replays }: { replays: ReplaySummary[] }) {
  return (
    <section className="rounded-2xl border bg-background p-5" id="replay">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <Video className="size-4 text-primary" /> Session replay
        <span className="text-xs font-normal text-muted-foreground">· last 30 days (sampled)</span>
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Watch anonymized shopper sessions — cursor movement, scrolling, clicks and page flow.
        Recordings capture coordinates only (no text, forms or personal data), so passwords and
        payment details can never appear.
      </p>
      <ReplayPanel items={replays} />
    </section>
  );
}
