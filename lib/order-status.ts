import type { OrderStatus } from "@prisma/client";

/** Order status config — the single source of truth shared by server actions,
 *  the admin status picker, the customer timeline, badges and the track page.
 *  Client-safe (no server-only imports). */

/** Linear fulfilment journey shown in the customer tracker (in order). */
export const ORDER_FLOW = [
  "PENDING",
  "APPROVED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const satisfies readonly OrderStatus[];

/** Statuses an admin can set, in workflow order (excludes legacy PAID/REFUNDED). */
export const ADMIN_STATUS_OPTIONS = [
  ...ORDER_FLOW,
  "CANCELLED",
  "RETURNED",
] as const satisfies readonly OrderStatus[];

/** Terminal states that release reserved stock back to inventory. */
export const CLOSED_STATUSES: OrderStatus[] = ["CANCELLED", "REFUNDED", "RETURNED"];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  APPROVED: "Approved",
  PROCESSING: "Processing",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
};

/** Short copy for the timeline step descriptions. */
export const ORDER_STATUS_BLURB: Partial<Record<OrderStatus, string>> = {
  PENDING: "Order placed and awaiting confirmation",
  APPROVED: "Confirmed by the store",
  PROCESSING: "Being prepared",
  PACKED: "Packed and ready to ship",
  SHIPPED: "Handed to the courier",
  OUT_FOR_DELIVERY: "Arriving today",
  DELIVERED: "Delivered",
};

export function statusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABEL[status] ?? status;
}

export const statusBadgeVariant: Record<
  OrderStatus,
  "secondary" | "default" | "destructive"
> = {
  PENDING: "secondary",
  PAID: "default",
  APPROVED: "default",
  PROCESSING: "default",
  PACKED: "default",
  SHIPPED: "default",
  OUT_FOR_DELIVERY: "default",
  DELIVERED: "default",
  CANCELLED: "destructive",
  RETURNED: "destructive",
  REFUNDED: "destructive",
};

export function isClosed(status: OrderStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

/**
 * Customers can cancel only while the order is still PENDING (i.e. before the
 * admin approves it for fulfilment). Once APPROVED/PROCESSING/SHIPPED/etc., the
 * customer cancel option disappears (the admin can still cancel).
 */
export function isCustomerCancellable(status: OrderStatus): boolean {
  return status === "PENDING";
}

/** Position of a status in ORDER_FLOW, or -1 if it isn't a linear step. */
export function flowIndex(status: OrderStatus): number {
  return (ORDER_FLOW as readonly OrderStatus[]).indexOf(status);
}
