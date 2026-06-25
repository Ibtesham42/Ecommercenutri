"use client";

import { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { AiChat } from "@/components/storefront/ai-chat";

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
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Sparkles className="size-4" />
        Ask AI about {productName}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUESTIONS.slice(0, 4).map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => ask(q)}
            className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
          >
            {q}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => ask()}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        Open AI assistant <ArrowRight className="size-3" />
      </button>
    </div>
  );
}
