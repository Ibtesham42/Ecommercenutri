"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Sparkles } from "lucide-react";

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
    <div className="border-b border-border pb-4">
      <div className="flex items-center justify-between gap-4">
        <p className="min-w-0 text-sm">
          <span className="block font-medium text-foreground">Questions about this product?</span>
          <span className="text-muted-foreground">Ask our assistant about ingredients, use or storage.</span>
        </p>
        <button
          type="button"
          onClick={() => ask()}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold underline decoration-foreground/35 underline-offset-[5px] hover:decoration-current"
        >
          <Sparkles aria-hidden className="size-3.5 text-sage-deep" /> Ask
        </button>
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
        {QUESTIONS.slice(0, 3).map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => ask(q)}
              className="inline-flex min-h-11 items-center text-[13px] text-foreground/70 underline-offset-4 hover:text-foreground hover:underline [@media(pointer:fine)]:min-h-8"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
