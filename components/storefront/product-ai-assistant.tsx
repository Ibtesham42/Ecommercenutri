"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Sparkles, ArrowRight } from "lucide-react";

// Lazy-loaded: the full chat UI (message list, streaming, recommendation
// cards) only enters the PDP bundle once a shopper actually opens it — same
// pattern as QuickViewDialog. Most PDP visitors never click this, so it
// shouldn't weigh down every product page's initial load.
const AiChat = dynamic(
  () => import("@/components/storefront/ai-chat").then((m) => m.AiChat),
  { ssr: false },
);

const QUESTIONS = [
  "What are the benefits?",
  "What are the ingredients?",
  "What's the nutrition?",
  "Best time to consume?",
  "How should I store it?",
  "Any side effects?",
  "Who should consume this?",
  "Who should avoid this?",
];

export function ProductAiAssistant({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState<string | undefined>(undefined);

  function ask(q?: string) {
    setQuestion(q);
    setOpen(true);
  }

  if (open) {
    return (
      <AiChat
        productId={productId}
        initialQuestion={question}
        greeting={`Ask me anything about ${productName}.`}
        suggestions={QUESTIONS}
        heightClass="h-80"
      />
    );
  }

  return (
    <div className="rounded-xl bg-oat p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Sparkles aria-hidden className="size-4 text-primary" />
        Ask AI about {productName}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUESTIONS.slice(0, 4).map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => ask(q)}
            className="inline-flex h-11 items-center rounded-full border border-border bg-background px-3.5 text-[13px] text-foreground/80 transition-colors hover:border-foreground/40 hover:text-foreground [@media(pointer:fine)]:h-9"
          >
            {q}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => ask()}
        className="mt-2 inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-primary underline-offset-4 hover:underline [@media(pointer:fine)]:min-h-8"
      >
        Open AI assistant <ArrowRight className="size-3" />
      </button>
    </div>
  );
}
