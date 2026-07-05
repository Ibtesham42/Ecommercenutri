import type { Metadata } from "next";
import { headers } from "next/headers";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { SurveyDashboard } from "@/components/admin/survey-dashboard";
import { getSurveyResponses, getSurveyStats } from "@/lib/queries/survey";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Survey", robots: { index: false } };

export default async function AdminSurveyPage() {
  await guardSection("customers");

  const [stats, responses] = await Promise.all([getSurveyStats(), getSurveyResponses(200)]);

  // Build the share link from the live request host (works on any domain —
  // nutriyet.in in production, localhost in dev); env.appUrl is the fallback.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const base = host ? `${proto}://${host}` : env.appUrl.replace(/\/$/, "");

  return (
    <div>
      <PageHeader
        title="Consumer Survey"
        description="Consumer Awareness & Healthy Snacking Survey — share the link, watch responses and statistics update live."
      />
      <SurveyDashboard
        stats={stats}
        responses={responses.map((r) => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          ageGroup: r.ageGroup,
          gender: r.gender,
          occupation: r.occupation,
          occupationOther: r.occupationOther,
          city: r.city,
          snackFrequency: r.snackFrequency,
          snacks: r.snacks,
          snacksOther: r.snacksOther,
          snackPriority: r.snackPriority,
          makhanaEaten: r.makhanaEaten,
          makhanaAware: r.makhanaAware,
          makhanaForms: r.makhanaForms,
          makhanaBarriers: r.makhanaBarriers,
          makhanaBarrierOther: r.makhanaBarrierOther,
          buyPlaces: r.buyPlaces,
          packSize: r.packSize,
          flavours: r.flavours,
          flavourOther: r.flavourOther,
          learnInterest: r.learnInterest,
          topics: r.topics,
          wantsUpdates: r.wantsUpdates,
          contactName: r.contactName,
          contactMobile: r.contactMobile,
          contactEmail: r.contactEmail,
        }))}
        surveyUrl={`${base}/survey`}
      />
    </div>
  );
}
