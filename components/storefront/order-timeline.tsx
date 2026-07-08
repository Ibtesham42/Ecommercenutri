import { Check, XCircle, RotateCcw } from "lucide-react";
import type { OrderStatus } from "@prisma/client";
import {
  ORDER_FLOW,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_BLURB,
  flowIndex,
  isClosed,
} from "@/lib/order-status";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TimelineEvent = {
  status: OrderStatus;
  note: string | null;
  createdAt: string; // ISO
};

/** Most recent timestamp recorded for a status, if any. */
function timeFor(events: TimelineEvent[], status: OrderStatus): string | null {
  const hit = events.filter((e) => e.status === status).at(-1);
  return hit ? hit.createdAt : null;
}

/** Most recent admin note recorded for a status (e.g. tracking number), if any. */
function noteFor(events: TimelineEvent[], status: OrderStatus): string | null {
  const hit = events.filter((e) => e.status === status && e.note?.trim()).at(-1);
  return hit?.note?.trim() ?? null;
}

/**
 * Vertical order tracker. Renders the linear fulfilment journey with timestamps,
 * marking reached steps; cancelled/returned orders show a dedicated terminal row
 * with the reason. Works with zero events (falls back to the placed date).
 */
export function OrderTimeline({
  status,
  events,
  placedAt,
  cancelReason,
}: {
  status: OrderStatus;
  events: TimelineEvent[];
  placedAt: string; // ISO
  cancelReason?: string | null;
}) {
  const closed = isClosed(status);
  // How far down the linear flow the order reached (max of current + any history).
  const reachedFromHistory = events.reduce((max, e) => {
    const i = flowIndex(e.status);
    return i > max ? i : max;
  }, -1);
  const currentIndex = closed
    ? reachedFromHistory
    : Math.max(flowIndex(status), reachedFromHistory);

  return (
    <div>
      <ol className="space-y-0">
        {ORDER_FLOW.map((step, i) => {
          const reached = i <= currentIndex;
          const isCurrent = !closed && i === currentIndex;
          const at =
            timeFor(events, step) ?? (step === "PENDING" ? placedAt : null);
          const note = reached ? noteFor(events, step) : null;
          const isLast = i === ORDER_FLOW.length - 1;
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
                  <span
                    className={cn(
                      "min-h-8 w-0.5 flex-1",
                      i < currentIndex ? "bg-primary" : "bg-muted",
                    )}
                  />
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
                  {ORDER_STATUS_LABEL[step]}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ORDER_STATUS_BLURB[step]}
                </p>
                {at && reached && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(at)}
                  </p>
                )}
                {note && (
                  <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-xs text-foreground/80">
                    {note}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {closed && (
        <div
          className={cn(
            "mt-2 flex items-start gap-3 rounded-xl border p-4",
            "border-destructive/30 bg-destructive/5",
          )}
        >
          {status === "RETURNED" ? (
            <RotateCcw className="mt-0.5 size-5 shrink-0 text-destructive" />
          ) : (
            <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          )}
          <div>
            <p className="text-sm font-semibold">
              Order {ORDER_STATUS_LABEL[status].toLowerCase()}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {formatDateTime(timeFor(events, status) ?? placedAt)}
              </span>
            </p>
            {cancelReason && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Reason: {cancelReason}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
