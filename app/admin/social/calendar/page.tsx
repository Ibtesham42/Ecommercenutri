import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { getSocialPosts } from "@/lib/queries/social";
import { STRATEGY, PILLAR_LABEL, DAYPART_LABEL } from "@/lib/social/strategy";
import { POST_STATUS_LABEL, POST_STATUS_VARIANT } from "@/lib/social/status";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Content Calendar", robots: { index: false } };

export default async function SocialCalendarPage() {
  const upcoming = await getSocialPosts(["SCHEDULED", "PENDING_APPROVAL", "DRAFT"]);
  const byWeek = [1, 2, 3, 4].map((w) => ({
    week: w,
    slots: STRATEGY.filter((s) => s.week === w),
  }));

  return (
    <div>
      <PageHeader
        title="Content Calendar"
        description="The rotating 4-week strategy, plus what's queued to go out."
      />

      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">4-week strategy</h2>
      <div className="mb-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {byWeek.map(({ week, slots }) => (
          <div key={week} className="rounded-xl border p-3 shadow-elev-1">
            <p className="mb-2 font-semibold">Week {week}</p>
            <div className="space-y-2">
              {slots.map((s) => (
                <div key={s.daypart} className="rounded-lg bg-muted/40 p-2">
                  <p className="text-xs font-medium text-muted-foreground">{DAYPART_LABEL[s.daypart]}</p>
                  <p className="text-sm font-medium">{PILLAR_LABEL[s.pillar]}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.angles.join(" · ")}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Upcoming ({upcoming.length})</h2>
      {upcoming.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing queued yet.
        </div>
      ) : (
        <div className="grid gap-2">
          {upcoming.slice(0, 60).map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
              <Badge variant={POST_STATUS_VARIANT[p.status]}>{POST_STATUS_LABEL[p.status]}</Badge>
              <span className="w-32 shrink-0 text-xs text-muted-foreground">
                {p.scheduledFor
                  ? new Date(p.scheduledFor).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                  : "unscheduled"}
              </span>
              <span className="min-w-0 flex-1 truncate">{p.hook || p.caption.split("\n")[0]}</span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{PILLAR_LABEL[p.pillar]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
