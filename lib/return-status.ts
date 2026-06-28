import type { ReturnStatus } from "@prisma/client";

/** Return/refund status config — the single source of truth shared by server
 *  actions, the admin action panel, the customer timeline and badges. Client-safe
 *  (no server-only imports), mirroring `lib/order-status.ts`. */

/** Linear return journey shown in the customer timeline (in order). REJECTED and
 *  CANCELLED are terminal branches rendered separately. */
export const RETURN_FLOW = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PICKUP_SCHEDULED",
  "REFUNDED",
] as const satisfies readonly ReturnStatus[];

/** Terminal states — no further customer/admin transitions. */
export const RETURN_TERMINAL: ReturnStatus[] = ["REFUNDED", "REJECTED", "CANCELLED"];

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  REQUESTED: "Request submitted",
  UNDER_REVIEW: "Under review",
  INFO_REQUESTED: "Info requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PICKUP_SCHEDULED: "Pickup scheduled",
  ITEM_RECEIVED: "Item received",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

/** Short copy for the timeline step descriptions. */
export const RETURN_STATUS_BLURB: Partial<Record<ReturnStatus, string>> = {
  REQUESTED: "We've received your return request",
  UNDER_REVIEW: "Our team is reviewing your request",
  APPROVED: "Your return has been approved",
  PICKUP_SCHEDULED: "A pickup has been scheduled",
  REFUNDED: "Your refund has been processed",
};

export function returnStatusLabel(status: ReturnStatus): string {
  return RETURN_STATUS_LABEL[status] ?? status;
}

export const returnBadgeVariant: Record<
  ReturnStatus,
  "secondary" | "default" | "destructive" | "outline"
> = {
  REQUESTED: "secondary",
  UNDER_REVIEW: "secondary",
  INFO_REQUESTED: "outline",
  APPROVED: "default",
  PICKUP_SCHEDULED: "default",
  ITEM_RECEIVED: "default",
  REFUNDED: "default",
  REJECTED: "destructive",
  CANCELLED: "destructive",
};

export function isReturnTerminal(status: ReturnStatus): boolean {
  return RETURN_TERMINAL.includes(status);
}

export function isReturnOpen(status: ReturnStatus): boolean {
  return !isReturnTerminal(status);
}

/** A customer may withdraw a return only before it's approved/processed. */
export function canCustomerCancelReturn(status: ReturnStatus): boolean {
  return status === "REQUESTED" || status === "UNDER_REVIEW" || status === "INFO_REQUESTED";
}

/** Position of a status in RETURN_FLOW, or -1 if it isn't a linear step. */
export function returnFlowIndex(status: ReturnStatus): number {
  return (RETURN_FLOW as readonly ReturnStatus[]).indexOf(status);
}
