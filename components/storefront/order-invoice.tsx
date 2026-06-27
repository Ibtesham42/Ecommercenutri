"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice, formatDate } from "@/lib/format";

export type InvoiceData = {
  orderNumber: string;
  placedAt: string; // ISO
  paymentStatus: string;
  store: {
    name: string;
    address: string | null;
    gstin: string | null;
    supportEmail: string | null;
    supportPhone: string | null;
  };
  billTo: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
  } | null;
  items: {
    productName: string;
    variantLabel: string;
    quantity: number;
    price: number; // unit, paise
  }[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  tax: number;
  shipping: number;
  shippingSaved: number;
  total: number;
};

/** Printable tax invoice. GST is inclusive — `tax` is the component contained in
 *  the goods value, shown as a note (the total is unchanged by it). */
export function OrderInvoice({ data }: { data: InvoiceData }) {
  const goods = Math.max(0, data.subtotal - data.discount);
  const taxableValue = Math.max(0, goods - data.tax);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold">Invoice</h1>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="size-4" /> Print / Save PDF
        </Button>
      </div>

      <div className="rounded-2xl border p-6 print:border-0 print:p-0">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div>
            <p className="text-lg font-bold">{data.store.name}</p>
            {data.store.address && (
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                {data.store.address}
              </p>
            )}
            {data.store.gstin && (
              <p className="mt-1 text-xs text-muted-foreground">
                GSTIN: <span className="font-medium">{data.store.gstin}</span>
              </p>
            )}
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold uppercase tracking-wide text-muted-foreground">
              Tax Invoice
            </p>
            <p className="mt-1 font-medium">#{data.orderNumber}</p>
            <p className="text-xs text-muted-foreground">{formatDate(data.placedAt)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Payment: {data.paymentStatus}
            </p>
          </div>
        </div>

        {/* Bill to */}
        {data.billTo && (
          <div className="border-b py-4 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
              Bill to
            </p>
            <p className="font-medium">{data.billTo.fullName}</p>
            <p className="text-muted-foreground">
              {data.billTo.line1}
              {data.billTo.line2 ? `, ${data.billTo.line2}` : ""}
              <br />
              {data.billTo.city}, {data.billTo.state} {data.billTo.pincode}
              <br />
              {data.billTo.country} · {data.billTo.phone}
            </p>
          </div>
        )}

        {/* Items */}
        <table className="w-full border-collapse py-2 text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 font-semibold">Item</th>
              <th className="py-2 text-center font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Price</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2.5">
                  {item.productName}
                  <span className="block text-xs text-muted-foreground">
                    {item.variantLabel}
                  </span>
                </td>
                <td className="py-2.5 text-center">{item.quantity}</td>
                <td className="py-2.5 text-right">{formatPrice(item.price)}</td>
                <td className="py-2.5 text-right font-medium">
                  {formatPrice(item.price * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary */}
        <div className="ml-auto mt-4 max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatPrice(data.subtotal)}</span>
          </div>
          {data.discount > 0 && (
            <div className="flex justify-between text-primary">
              <span>Discount {data.couponCode ? `(${data.couponCode})` : ""}</span>
              <span>−{formatPrice(data.discount)}</span>
            </div>
          )}
          {data.tax > 0 && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxable value</span>
                <span>{formatPrice(taxableValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST</span>
                <span>{formatPrice(data.tax)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery</span>
            <span className={data.shipping === 0 ? "font-semibold text-primary" : ""}>
              {data.shipping === 0 ? "Free Delivery" : formatPrice(data.shipping)}
            </span>
          </div>
          {data.shipping === 0 && data.shippingSaved > 0 && (
            <div className="flex justify-between text-xs text-primary">
              <span>You saved on shipping</span>
              <span>{formatPrice(data.shippingSaved)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Total</span>
            <span>{formatPrice(data.total)}</span>
          </div>
        </div>

        <p className="mt-6 border-t pt-4 text-center text-xs text-muted-foreground">
          {data.tax > 0
            ? "Prices are inclusive of GST. "
            : ""}
          Thank you for shopping with {data.store.name}.
          {data.store.supportEmail ? ` Questions? ${data.store.supportEmail}` : ""}
        </p>
      </div>
    </div>
  );
}
