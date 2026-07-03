import * as React from "react";
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

// `React` is referenced so the module works under both JSX runtimes.
void React;

/**
 * Analytics report PDF. The data is fully pre-formatted strings assembled by
 * the route (this layer stays dumb, like the invoice PDF). Helvetica has no ₹
 * glyph, so money arrives as ASCII "Rs. …".
 */
export type AnalyticsReportData = {
  storeName: string;
  rangeLabel: string;
  generatedAt: string;
  kpis: { label: string; value: string; delta: string; note: string }[];
  funnel: { stage: string; count: string; conv: string; drop: string; delta: string }[];
  productSections: { title: string; rows: { name: string; value: string; detail: string }[] }[];
  geoSections: { title: string; rows: { name: string; value: string; detail: string }[] }[];
  recovery: { label: string; value: string }[];
};

const GREEN = "#16803c";
const MUTED = "#6b7a72";
const BORDER = "#e3ece6";
const INK = "#13241c";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold", color: GREEN },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right" },
  muted: { color: MUTED },
  between: { flexDirection: "row", justifyContent: "space-between" },
  hr: { borderBottomWidth: 1, borderBottomColor: BORDER, marginVertical: 12 },
  section: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 6,
    color: GREEN,
    textTransform: "uppercase",
  },
  th: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 3,
    color: MUTED,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    textTransform: "uppercase",
  },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingVertical: 3 },
  c1: { flex: 2.2 },
  c2: { flex: 1, textAlign: "right" },
  c3: { flex: 1, textAlign: "right" },
  c4: { flex: 1.4, textAlign: "right", color: MUTED },
});

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  const cols = [s.c1, s.c2, s.c3, s.c4];
  return (
    <View>
      <View style={s.th}>
        {headers.map((h, i) => (
          <Text key={i} style={cols[i]}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.tr}>
          {r.map((cell, j) => (
            <Text key={j} style={cols[j]}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function ReportDoc({ data }: { data: AnalyticsReportData }) {
  return (
    <Document title={`Analytics report — ${data.rangeLabel}`}>
      <Page size="A4" style={s.page}>
        <View style={s.between}>
          <Text style={s.brand}>{data.storeName}</Text>
          <View>
            <Text style={s.title}>Analytics report</Text>
            <Text style={[s.muted, { textAlign: "right" }]}>{data.rangeLabel}</Text>
            <Text style={[s.muted, { textAlign: "right" }]}>Generated {data.generatedAt}</Text>
          </View>
        </View>
        <View style={s.hr} />

        <Text style={s.section}>Key metrics</Text>
        <Table
          headers={["Metric", "Value", "Change", "Note"]}
          rows={data.kpis.map((k) => [k.label, k.value, k.delta, k.note])}
        />

        <Text style={s.section}>Conversion funnel</Text>
        <Table
          headers={["Stage", "Count", "Conv %", "Drop / trend"]}
          rows={data.funnel.map((f) => [f.stage, f.count, f.conv, `${f.drop} ${f.delta}`.trim()])}
        />

        {data.productSections.map((sec) => (
          <View key={sec.title} wrap={false}>
            <Text style={s.section}>{sec.title}</Text>
            {sec.rows.length === 0 ? (
              <Text style={s.muted}>No data for this period.</Text>
            ) : (
              <Table
                headers={["Product", "Value", "", "Detail"]}
                rows={sec.rows.map((r) => [r.name, r.value, "", r.detail])}
              />
            )}
          </View>
        ))}

        {data.geoSections.map((sec) => (
          <View key={sec.title} wrap={false}>
            <Text style={s.section}>{sec.title}</Text>
            {sec.rows.length === 0 ? (
              <Text style={s.muted}>No data for this period.</Text>
            ) : (
              <Table
                headers={["Name", "Value", "", "Detail"]}
                rows={sec.rows.map((r) => [r.name, r.value, "", r.detail])}
              />
            )}
          </View>
        ))}

        <View wrap={false}>
          <Text style={s.section}>Cart recovery</Text>
          <Table headers={["Metric", "Value", "", ""]} rows={data.recovery.map((r) => [r.label, r.value, "", ""])} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderAnalyticsReportBuffer(data: AnalyticsReportData): Promise<Buffer> {
  return renderToBuffer(<ReportDoc data={data} />);
}
