import * as React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { InvoiceData } from "@/components/storefront/order-invoice";

// `React` is referenced so the module works under both the classic and automatic
// JSX runtimes (e.g. when rendered outside Next's transform).
void React;

// Helvetica (the built-in font) has no Rupee glyph, so money is rendered ASCII.
function rs(paise: number): string {
  return (
    "Rs. " +
    (paise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Force a PNG delivery for Cloudinary logos so react-pdf can rasterize them. */
function logoSrc(url: string): string {
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    return url.replace("/upload/", "/upload/f_png,q_auto/");
  }
  return url;
}

const GREEN = "#16803c";
const MUTED = "#6b7a72";
const BORDER = "#e3ece6";
const INK = "#13241c";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold", color: GREEN },
  logo: { height: 34, objectFit: "contain" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "right" },
  muted: { color: MUTED },
  hr: { borderBottomWidth: 1, borderBottomColor: BORDER, marginVertical: 12 },
  sectionLabel: {
    fontSize: 8,
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 3,
    fontFamily: "Helvetica-Bold",
  },
  bold: { fontFamily: "Helvetica-Bold" },
  col: { flexDirection: "column" },
  th: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 4,
    marginTop: 14,
    color: MUTED,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    fontSize: 8,
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 5,
  },
  cItem: { flex: 1, paddingRight: 6 },
  cQty: { width: 36, textAlign: "center" },
  cPrice: { width: 80, textAlign: "right" },
  cAmt: { width: 80, textAlign: "right" },
  summary: { marginTop: 12, marginLeft: "auto", width: 230 },
  sLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
    marginTop: 4,
  },
  footer: {
    marginTop: 22,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 10,
    color: MUTED,
    fontSize: 8,
    textAlign: "center",
  },
});

function Address({ a }: { a: InvoiceData["billTo"] }) {
  if (!a) return null;
  return (
    <View style={s.col}>
      <Text style={s.bold}>{a.fullName}</Text>
      <Text style={s.muted}>
        {a.line1}
        {a.line2 ? `, ${a.line2}` : ""}
      </Text>
      <Text style={s.muted}>
        {a.city}, {a.state} {a.pincode}
      </Text>
      <Text style={s.muted}>
        {a.country} · {a.phone}
      </Text>
    </View>
  );
}

function InvoiceDocument({ data, withLogo }: { data: InvoiceData; withLogo: boolean }) {
  const goods = Math.max(0, data.subtotal - data.discount);
  const taxableValue = Math.max(0, goods - data.tax);
  const methodLabel = data.paymentMethod === "COD" ? "Cash on Delivery" : "Paid online";

  return (
    <Document title={data.invoiceNumber}>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.between}>
          <View style={s.col}>
            {withLogo && data.store.logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image is a PDF primitive, not an HTML img
              <Image src={logoSrc(data.store.logo)} style={s.logo} />
            ) : (
              <Text style={s.brand}>{data.store.name}</Text>
            )}
            <Text style={[s.muted, { marginTop: 4, maxWidth: 240 }]}>
              {data.store.address ?? ""}
            </Text>
            {data.store.gstin ? (
              <Text style={s.muted}>GSTIN: {data.store.gstin}</Text>
            ) : null}
            {data.store.supportEmail ? (
              <Text style={s.muted}>{data.store.supportEmail}</Text>
            ) : null}
          </View>
          <View style={s.col}>
            <Text style={s.title}>TAX INVOICE</Text>
            <Text style={[s.bold, { textAlign: "right", marginTop: 4 }]}>
              {data.invoiceNumber}
            </Text>
            <Text style={[s.muted, { textAlign: "right" }]}>
              Issued {fmtDate(data.issuedAt)}
            </Text>
            <Text style={[s.muted, { textAlign: "right" }]}>
              Order #{data.orderNumber} · {fmtDate(data.placedAt)}
            </Text>
          </View>
        </View>

        <View style={s.hr} />

        {/* Bill to / payment */}
        <View style={s.between}>
          <View style={[s.col, { maxWidth: 260 }]}>
            <Text style={s.sectionLabel}>Bill to</Text>
            <Address a={data.billTo} />
          </View>
          <View style={[s.col, { alignItems: "flex-end" }]}>
            <Text style={s.sectionLabel}>Payment</Text>
            <Text style={s.bold}>{methodLabel}</Text>
            <Text style={s.muted}>Status: {data.paymentStatus}</Text>
          </View>
        </View>

        {/* Items */}
        <View style={s.th}>
          <Text style={s.cItem}>Item</Text>
          <Text style={s.cQty}>Qty</Text>
          <Text style={s.cPrice}>Price</Text>
          <Text style={s.cAmt}>Amount</Text>
        </View>
        {data.items.map((it, i) => (
          <View style={s.tr} key={i}>
            <View style={s.cItem}>
              <Text>{it.productName}</Text>
              <Text style={s.muted}>{it.variantLabel}</Text>
            </View>
            <Text style={s.cQty}>{it.quantity}</Text>
            <Text style={s.cPrice}>{rs(it.price)}</Text>
            <Text style={s.cAmt}>{rs(it.price * it.quantity)}</Text>
          </View>
        ))}

        {/* Summary */}
        <View style={s.summary}>
          <View style={s.sLine}>
            <Text style={s.muted}>Subtotal</Text>
            <Text>{rs(data.subtotal)}</Text>
          </View>
          {data.discount > 0 ? (
            <View style={s.sLine}>
              <Text style={s.muted}>
                Discount{data.couponCode ? ` (${data.couponCode})` : ""}
              </Text>
              <Text>- {rs(data.discount)}</Text>
            </View>
          ) : null}
          {data.tax > 0 ? (
            <>
              <View style={s.sLine}>
                <Text style={s.muted}>Taxable value</Text>
                <Text>{rs(taxableValue)}</Text>
              </View>
              <View style={s.sLine}>
                <Text style={s.muted}>GST</Text>
                <Text>{rs(data.tax)}</Text>
              </View>
            </>
          ) : null}
          <View style={s.sLine}>
            <Text style={s.muted}>Delivery</Text>
            <Text>{data.shipping === 0 ? "Free" : rs(data.shipping)}</Text>
          </View>
          {data.codFee > 0 ? (
            <View style={s.sLine}>
              <Text style={s.muted}>Cash on Delivery fee</Text>
              <Text>{rs(data.codFee)}</Text>
            </View>
          ) : null}
          <View style={s.totalLine}>
            <Text style={s.bold}>Total</Text>
            <Text style={s.bold}>{rs(data.total)}</Text>
          </View>
        </View>

        <Text style={s.footer}>
          {data.tax > 0 ? "Prices are inclusive of GST. " : ""}
          This is a computer-generated invoice. Thank you for shopping with{" "}
          {data.store.name}.
        </Text>
      </Page>
    </Document>
  );
}

/**
 * Render the invoice to a PDF Buffer. Tries with the store logo first; if the
 * logo can't be rasterized (SVG/unreachable), retries without it so a PDF is
 * always produced.
 */
export async function renderInvoiceBuffer(data: InvoiceData): Promise<Buffer> {
  try {
    return await renderToBuffer(<InvoiceDocument data={data} withLogo />);
  } catch {
    return renderToBuffer(<InvoiceDocument data={data} withLogo={false} />);
  }
}
