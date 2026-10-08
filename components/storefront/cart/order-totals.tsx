import { formatPrice } from "@/lib/format";
import type { PriceBreakdown } from "@/lib/pricing";

/**
 * The money rows shared by the cart and checkout summaries. Takes the
 * breakdown from `computeBreakdown`/`previewOrderPricing` as-is — no arithmetic
 * here, so the UI can never disagree with the server's totals.
 */
export function OrderTotals({
  breakdown: { subtotal, discount, shipping, shippingSaved, codFee, tax, total },
  couponCode,
}: {
  breakdown: PriceBreakdown;
  couponCode?: string;
}) {
  return (
    <div className="space-y-2.5 text-sm">
      <Row label="Subtotal" value={formatPrice(subtotal)} />
      {discount > 0 && (
        <Row
          label={couponCode ? `Discount (${couponCode})` : "Discount"}
          value={`−${formatPrice(discount)}`}
          accent
        />
      )}
      <Row
        label="Delivery"
        value={shipping === 0 ? "Free" : formatPrice(shipping)}
        accent={shipping === 0}
      />
      {shipping === 0 && shippingSaved > 0 && (
        <p className="-mt-1 text-xs text-muted-foreground">
          You save {formatPrice(shippingSaved)} on delivery
        </p>
      )}
      {codFee > 0 && <Row label="Cash on Delivery fee" value={formatPrice(codFee)} />}
      <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3.5">
        <span className="text-base font-medium">Total</span>
        <span className="text-xl font-semibold tracking-tight tabular-nums">{formatPrice(total)}</span>
      </div>
      {tax > 0 && (
        <p className="-mt-1 text-right text-xs text-muted-foreground">
          Inclusive of {formatPrice(tax)} GST
        </p>
      )}
    </div>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "font-medium text-primary tabular-nums" : "font-medium tabular-nums"}>
        {value}
      </span>
    </div>
  );
}
