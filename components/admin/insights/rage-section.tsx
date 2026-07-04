import { MousePointerBan } from "lucide-react";
import type { RageIssue } from "@/lib/queries/engagement";

const nf = new Intl.NumberFormat("en-IN");

/**
 * Rage-click detection — elements shoppers repeatedly clicked in frustration
 * (3+ clicks in under a second on the same spot). Each row is a probable UX
 * issue: something that looks clickable but is slow, disabled or broken.
 * The AI explanation for the top issue lives in the heatmap insights card.
 */
export function RageSection({ issues, total }: { issues: RageIssue[]; total: number }) {
  return (
    <section className="rounded-2xl border bg-background p-5" id="rage">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <MousePointerBan className="size-4 text-primary" /> Rage clicks
        {total > 0 && (
          <span className="text-xs font-normal text-muted-foreground">
            · {nf.format(total)} detected this period
          </span>
        )}
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Repeated rapid clicks on one spot signal a frustrated shopper — usually a control that looks
        clickable but is disabled, slow, or broken.
      </p>

      {issues.length === 0 ? (
        <p className="py-5 text-center text-sm text-muted-foreground">
          No rage clicks detected in this period — nothing seems to be frustrating shoppers. 🎉
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Element</th>
                <th className="py-2 pr-3 font-medium">Page</th>
                <th className="py-2 pr-3 text-right font-medium">Bursts</th>
                <th className="py-2 pr-3 text-right font-medium">Shoppers</th>
                <th className="py-2 text-right font-medium">vs prev period</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{issue.label}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{issue.path}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{nf.format(issue.count)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{nf.format(issue.sessions)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {issue.deltaPct === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className={issue.deltaPct <= 0 ? "text-primary" : "text-destructive"}>
                        {issue.deltaPct >= 0 ? "↑" : "↓"} {Math.abs(issue.deltaPct).toFixed(0)}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            Quick checks: is the control disabled without looking disabled? Does it lack a loading
            state after the first click? On product images, shoppers may be expecting a zoom.
          </p>
        </div>
      )}
    </section>
  );
}
