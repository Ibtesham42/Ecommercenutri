import type { Metadata } from "next";
import { Sparkles, AlertCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buildMetadata } from "@/lib/seo";
import { getAISettings } from "@/lib/ai/settings";
import { aiAvailable } from "@/lib/ai/provider";
import { AiChat } from "@/components/storefront/ai-chat";

export const metadata: Metadata = buildMetadata({
  title: "AI Nutrition Assistant",
  description:
    "Ask Nutriyet's AI nutrition expert anything about our products, nutrition and healthy eating.",
  path: "/assistant",
});

const GENERAL_SUGGESTIONS = [
  "What is makhana and why is it healthy?",
  "Best products for weight loss",
  "High-protein snacks under ₹500",
  "Which products are good for diabetics?",
  "Compare almonds and cashews",
];

const PRODUCT_SUGGESTIONS = [
  "What are the benefits?",
  "What's the nutrition?",
  "Best time to consume?",
  "Who should avoid this?",
  "How should I store it?",
];

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; q?: string }>;
}) {
  const { product, q } = await searchParams;

  let productId: string | undefined;
  let productName: string | undefined;
  if (product) {
    const p = await prisma.product.findFirst({
      where: { slug: product, isActive: true },
      select: { id: true, name: true },
    });
    if (p) {
      productId = p.id;
      productName = p.name;
    }
  }

  const settings = await getAISettings();
  const ready =
    aiAvailable() &&
    settings.enabled &&
    (productId ? settings.productAssistantEnabled : settings.assistantEnabled);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="size-7" />
        </span>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">AI Nutrition Assistant</h1>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          {productName
            ? `Ask anything about ${productName}.`
            : "Your personal nutrition expert, grounded in the Nutriyet catalog."}
        </p>
      </div>

      {!ready && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>
            The live AI assistant isn&apos;t active right now. You can still send a
            message — we&apos;ll show a helpful note and you can browse our products
            anytime.
          </p>
        </div>
      )}

      <AiChat
        productId={productId}
        initialQuestion={q}
        greeting={
          productName
            ? `Hi! Ask me anything about ${productName} — benefits, nutrition, how to use it and more.`
            : "Hi! I'm Nutri. Ask me about nutrition or which products suit your goals."
        }
        suggestions={productId ? PRODUCT_SUGGESTIONS : GENERAL_SUGGESTIONS}
        heightClass="h-[55vh]"
      />
    </div>
  );
}
