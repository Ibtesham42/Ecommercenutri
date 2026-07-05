import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getAllSurveyResponses } from "@/lib/queries/survey";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { SURVEY_QUESTIONS, surveyQuestion } from "@/lib/survey";
import type { SurveyResponse } from "@prisma/client";

export const runtime = "nodejs";

/** Download every survey response as CSV (English option labels). */
export async function GET() {
  try {
    await requirePermission("customers");
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const label = (qid: string, key: string) =>
    surveyQuestion(qid)?.options?.find((o) => o.key === key)?.en ?? key;

  const answerCols: CsvColumn<SurveyResponse>[] = SURVEY_QUESTIONS.filter(
    (q) => q.type !== "text",
  ).map((q) => ({
    header: `Q${q.num} ${q.en}`,
    value: (r) => {
      const v = r[q.id as keyof SurveyResponse];
      if (Array.isArray(v)) return v.map((k) => label(q.id, k)).join("; ");
      return typeof v === "string" ? label(q.id, v) : "";
    },
  }));

  const rows = await getAllSurveyResponses();
  const csv = toCsv(rows, [
    { header: "Date", value: (r) => r.createdAt.toISOString() },
    { header: "City / District", value: (r) => r.city ?? "" },
    ...answerCols,
    { header: "Occupation (other)", value: (r) => r.occupationOther ?? "" },
    { header: "Snacks (other)", value: (r) => r.snacksOther ?? "" },
    { header: "Makhana barrier (other)", value: (r) => r.makhanaBarrierOther ?? "" },
    { header: "Flavour (other)", value: (r) => r.flavourOther ?? "" },
    { header: "Name", value: (r) => r.contactName ?? "" },
    { header: "Mobile", value: (r) => r.contactMobile ?? "" },
    { header: "Email", value: (r) => r.contactEmail ?? "" },
  ]);

  const filename = `survey-responses-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
