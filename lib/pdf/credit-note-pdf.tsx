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
import type { CreditNoteData } from "@/lib/credit-notes";

void React;

// Helvetica has no Rupee glyph → money is rendered ASCII.
function rs(paise: number): string {
  return (
    "Rs. " +
    (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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
  col: { flexDirection: "column" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold", color: GREEN },
  logo: { height: 34, objectFit: "contain" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "right" },
  muted: { color: MUTED },
  bold: { fontFamily: "Helvetica-Bold" },
  hr: { borderBottomWidth: 1, borderBottomColor: BORDER, marginVertical: 12 },
  sectionLabel: {
    fontSize: 8,
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 3,
    fontFamily: "Helvetica-Bold",
  },
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
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 5 },
  cItem: { flex: 1, paddingRight: 6 },
  cQty: { width: 36, textAlign: "center" },
  cPrice: { width: 80, textAlign: "right" },
  cAmt: { width: 80, textAlign: "right" },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
    marginTop: 4,
    marginLeft: "auto",
    width: 230,
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

function CreditNoteDocument({ data, withLogo }: { data: CreditNoteData; withLogo: boolean }) {
  return (
    <Document title={data.number}>
      <Page size="A4" style={s.page}>
        <View style={s.between}>
          <View style={s.col}>
            {withLogo && data.store.logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image primitive
              <Image src={logoSrc(data.store.logo)} style={s.logo} />
            ) : (
              <Text style={s.brand}>{data.store.name}</Text>
            )}
            <Text style={[s.muted, { marginTop: 4, maxWidth: 240 }]}>
              {data.store.address ?? ""}
            </Text>
            {data.store.gstin ? <Text style={s.muted}>GSTIN: {data.store.gstin}</Text> : null}
            {data.store.supportEmail ? <Text style={s.muted}>{data.store.supportEmail}</Text> : null}
          </View>
          <View style={s.col}>
            <Text style={s.title}>CREDIT NOTE</Text>
            <Text style={[s.bold, { textAlign: "right", marginTop: 4 }]}>{data.number}</Text>
            <Text style={[s.muted, { textAlign: "right" }]}>Issued {fmtDate(data.issuedAt)}</Text>
            <Text style={[s.muted, { textAlign: "right" }]}>
              Return {data.returnNumber} · Order #{data.orderNumber}
            </Text>
          </View>
        </View>

        <View style={s.hr} />

        <View style={s.between}>
          <View style={[s.col, { maxWidth: 260 }]}>
            <Text style={s.sectionLabel}>Issued to</Text>
            <Text style={s.bold}>{data.customerName ?? "Customer"}</Text>
            <Text style={s.muted}>Reason: {data.reason}</Text>
          </View>
          <View style={[s.col, { alignItems: "flex-end" }]}>
            <Text style={s.sectionLabel}>Refund</Text>
            <Text style={s.bold}>
              {(data.refundMethod ?? "").replace(/_/g, " ") || "—"}
            </Text>
            {data.refundRef ? <Text style={s.muted}>Ref: {data.refundRef}</Text> : null}
          </View>
        </View>

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
            <Text style={s.cPrice}>{rs(it.unitPrice)}</Text>
            <Text style={s.cAmt}>{rs(it.unitPrice * it.quantity)}</Text>
          </View>
        ))}

        <View style={s.totalLine}>
          <Text style={s.bold}>Total refunded</Text>
          <Text style={s.bold}>{rs(data.amount)}</Text>
        </View>

        <Text style={s.footer}>
          This credit note records a refund issued against the order above. This is a
          computer-generated document from {data.store.name}.
        </Text>
      </Page>
    </Document>
  );
}

/** Render the credit note to a PDF Buffer (retries without the logo on failure). */
export async function renderCreditNoteBuffer(data: CreditNoteData): Promise<Buffer> {
  try {
    return await renderToBuffer(<CreditNoteDocument data={data} withLogo />);
  } catch {
    return renderToBuffer(<CreditNoteDocument data={data} withLogo={false} />);
  }
}
