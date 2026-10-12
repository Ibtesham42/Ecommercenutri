/**
 * Refund value of returned units — client-safe (the return form shows the same
 * estimate the server stores).
 *
 * Ordinary orders: unit price × quantity, exactly as before (`lineDiscount` is
 * 0 for them). Spin & Win orders carry the discount earned on each line
 * (`OrderItem.discount`), so a returned unit refunds what was actually paid
 * for it. The line discount is apportioned cumulatively — units already in
 * earlier active returns took `share(already)` — so any sequence of partial
 * returns refunds exactly `unitPrice × quantity − lineDiscount` in total,
 * never more, and rounding never drifts.
 */
export type RefundableLine = {
  unitPrice: number; // paise, price charged per unit before the line discount
  orderedQty: number;
  lineDiscount: number; // paise, whole-line Spin & Win discount (0 = none)
};

export function returnDiscountShare(line: RefundableLine, already: number, quantity: number): number {
  if (line.lineDiscount <= 0 || line.orderedQty <= 0 || quantity <= 0) return 0;
  const share = (n: number) =>
    Math.round((line.lineDiscount * Math.min(Math.max(n, 0), line.orderedQty)) / line.orderedQty);
  return share(already + quantity) - share(already);
}

export function returnLineValue(line: RefundableLine, already: number, quantity: number): number {
  if (quantity <= 0) return 0;
  return Math.max(0, line.unitPrice * quantity - returnDiscountShare(line, already, quantity));
}
