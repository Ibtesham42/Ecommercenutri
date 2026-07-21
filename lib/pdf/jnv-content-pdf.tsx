import * as React from "react";
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

// `React` is referenced so the module works under both JSX runtimes.
void React;

/**
 * Generic document PDF for Teacher AI Toolkit exports (lesson plans,
 * worksheets, question papers, ...) — plain title + wrapped body text, kept
 * dumb like the invoice/analytics PDF templates so it works for any of the
 * ~18 content types without per-type layout.
 */
export type JnvContentPdfData = {
  title: string;
  meta: string;
  body: string;
};

const BLUE = "#1d4ed8";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const INK = "#0f172a";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10.5, color: INK, fontFamily: "Helvetica", lineHeight: 1.5 },
  brand: { fontSize: 11, fontFamily: "Helvetica-Bold", color: BLUE },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 4 },
  meta: { fontSize: 9, color: MUTED, marginTop: 4 },
  hr: { borderBottomWidth: 1, borderBottomColor: BORDER, marginTop: 12, marginBottom: 16 },
  paragraph: { marginBottom: 8 },
});

function ContentDoc({ data }: { data: JnvContentPdfData }) {
  const paragraphs = data.body.split(/\n{2,}/).flatMap((block) => block.split("\n"));
  return (
    <Document title={data.title}>
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>JNV Smart Class — Byte AI Toolkit</Text>
        <Text style={s.title}>{data.title}</Text>
        <Text style={s.meta}>{data.meta}</Text>
        <View style={s.hr} />
        {paragraphs.map((line, i) =>
          line.trim() ? (
            <Text key={i} style={s.paragraph}>
              {line}
            </Text>
          ) : (
            <Text key={i}> </Text>
          ),
        )}
      </Page>
    </Document>
  );
}

export async function renderJnvContentPdfBuffer(data: JnvContentPdfData): Promise<Buffer> {
  return renderToBuffer(<ContentDoc data={data} />);
}
