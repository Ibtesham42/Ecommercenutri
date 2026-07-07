import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HealthQuiz } from "@/components/storefront/quiz/health-quiz";
import { getGrowthSettings } from "@/lib/growth-settings";
import { getCurrentUser } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

// buildMetadata for full parity (canonical + OG + Twitter card) — the quiz is a
// primary, heavily-promoted landing page that previously had none of those.
export const metadata: Metadata = buildMetadata({
  title: "Health Score Assessment — Free AI Nutrition Quiz",
  description:
    "Take the free 45-second Nutriyet Health Score assessment. Get your personal wellness score, AI snack recommendations and a welcome coupon.",
  path: "/quiz",
});

export default async function QuizPage() {
  const [growth, user] = await Promise.all([getGrowthSettings(), getCurrentUser()]);

  if (!growth.quizEnabled) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-20 text-center">
        <h1 className="font-heading text-2xl font-bold">Health assessment</h1>
        <p className="mt-2 text-muted-foreground">
          The health assessment isn&apos;t available right now. Please check back soon.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Back to shop</Link>
        </Button>
      </div>
    );
  }

  return <HealthQuiz isLoggedIn={!!user} couponPercent={growth.couponPercent} />;
}
