import { ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ActionPlan } from "@/lib/ai/insights";

/**
 * "What should I do this week?" — 3-5 data-grounded recommendations, AI-written
 * when Groq is configured, rule-based ("Auto") otherwise.
 */
export function ActionPlanCard({ plan }: { plan: ActionPlan }) {
  if (plan.items.length === 0) return null;
  return (
    <section className="rounded-2xl border bg-gradient-to-br from-primary/10 to-transparent p-5">
      <div className="mb-3 flex items-center gap-2">
        <ListChecks className="size-5 text-primary" />
        <h2 className="font-semibold">Recommended actions</h2>
        <Badge variant={plan.ai ? "default" : "secondary"}>{plan.ai ? "AI" : "Auto"}</Badge>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {plan.items.map((item, i) => (
          <li key={i} className="rounded-xl border bg-background/70 p-4">
            <p className="flex items-start gap-2 text-sm font-semibold">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                {i + 1}
              </span>
              {item.title}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.why}</p>
            <p className="mt-1.5 text-xs font-medium leading-relaxed text-foreground">✓ {item.action}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
