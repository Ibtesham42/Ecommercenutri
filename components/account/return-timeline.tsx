import { Check, XCircle } from "lucide-react";
import type { ReturnStatus } from "@prisma/client";
import {
  RETURN_FLOW,
  RETURN_STATUS_LABEL,
  RETURN_STATUS_BLURB,
  returnFlowIndex,
  isReturnTerminal,
} from "@/lib/return-status";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ReturnTimelineEvent = {
  status: ReturnStatus;
  note: string | null;
  createdAt: string; // ISO
};

function timeFor(events: ReturnTimelineEvent[], status: ReturnStatus): string | null {
  const hit = events.filter((e) => e.status === status).at(-1);
  return hit ? hit.createdAt : null;
}

/**
 * Vertical return tracker — mirrors the order timeline. Renders the linear return
 * journey (RETURN_FLOW) with timestamps; rejected/cancelled returns show a terminal
 * row with the reason. INFO_REQUESTED is surfaced as a note under "Under review".
 */
export function ReturnTimeline({
  status,
  events,
  requestedAt,
  rejectionReason,
}: {
  status: ReturnStatus;
  events: ReturnTimelineEvent[];
  requestedAt: string; // ISO
  rejectionReason?: string | null;
}) {
  const terminal = isReturnTerminal(status);
  const badBranch = status === "REJECTED" || status === "CANCELLED";

  const reachedFromHistory = events.reduce((max, e) => {
    const i = returnFlowIndex(e.status);
    return i > max ? i : max;
  }, -1);
  const currentIndex = badBranch
    ? reachedFromHistory
    : Math.max(returnFlowIndex(status), reachedFromHistory);

  const infoRequested = status === "INFO_REQUESTED";

  return (
    <div>
      <ol className="space-y-0">
        {RETURN_FLOW.map((step, i) => {
          const reached = i <= currentIndex;
          const isCurrent = !terminal && i === currentIndex;
          const at = timeFor(events, step) ?? (step === "REQUESTED" ? requestedAt : null);
          const isLast = i === RETURN_FLOW.length - 1;
          return (
            <li key={step} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors",
                    reached
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted bg-background text-muted-foreground",
                  )}
                >
                  {reached ? (
                    <Check className="size-4" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-current" />
                  )}
                </span>
                {!isLast && (
                  <span className={cn("min-h-8 w-0.5 flex-1", i < currentIndex ? "bg-primary" : "bg-muted")} />
                )}
              </div>
              <div className={cn("pb-6", isLast && "pb-0")}>
                <p
                  className={cn(
                    "text-sm font-medium",
                    reached ? "text-foreground" : "text-muted-foreground",
                    isCurrent && "text-primary",
                  )}
                >
                  {RETURN_STATUS_LABEL[step]}
                </p>
                <p className="text-xs text-muted-foreground">{RETURN_STATUS_BLURB[step]}</p>
                {at && reached && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(at)}</p>
                )}
                {step === "UNDER_REVIEW" && infoRequested && (
                  <p className="mt-1 text-xs font-medium text-amber-600">
                    We&rsquo;ve requested more information from you.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {badBranch && (
        <div className="mt-2 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold">
              Return {RETURN_STATUS_LABEL[status].toLowerCase()}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {formatDateTime(timeFor(events, status) ?? requestedAt)}
              </span>
            </p>
            {rejectionReason && (
              <p className="mt-0.5 text-sm text-muted-foreground">Reason: {rejectionReason}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
