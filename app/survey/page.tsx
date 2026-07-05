import type { Metadata } from "next";
import { SurveyForm } from "@/components/survey/survey-form";

// Link-only page: never indexed, never linked from the storefront.
export const metadata: Metadata = {
  title: "Consumer Awareness & Healthy Snacking Survey",
  robots: { index: false, follow: false },
};

export default function SurveyPage() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-5 text-center shadow-elev-1 sm:p-6">
        <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          NutriYet Consumer Awareness &amp; Healthy Snacking Survey
        </h1>
        <p className="mt-1 text-sm font-medium text-primary">
          उपभोक्ता जागरूकता एवं स्वस्थ नाश्ता सर्वेक्षण
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Thank you for participating! This survey takes only 2–3 minutes. Your responses will
          help us understand consumer preferences and improve nutrition awareness initiatives.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          भाग लेने के लिए धन्यवाद! यह सर्वेक्षण केवल 2–3 मिनट का है। आपके उत्तर हमें उपभोक्ताओं
          की पसंद समझने और पोषण जागरूकता कार्यक्रमों को बेहतर बनाने में सहायता करेंगे।
        </p>
      </div>
      <SurveyForm />
    </div>
  );
}
