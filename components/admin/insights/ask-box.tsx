"use client";

import { useState } from "react";
import { Sparkles, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { askBusinessQuestion } from "@/lib/actions/admin/insights";

const SUGGESTIONS = [
  "Why did sales change this week?",
  "Which products should I restock?",
  "Which products should I advertise?",
  "Who are my top customers?",
  "Which category generated the highest revenue?",
];

export function AskBox() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; ai: boolean } | null>(null);

  async function ask(question: string) {
    const query = question.trim();
    if (query.length < 2) return;
    setBusy(true);
    setAnswer(null);
    const res = await askBusinessQuestion(query);
    setBusy(false);
    if (res.ok) setAnswer({ text: res.text, ai: res.ai });
    else toast.error(res.error);
  }

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-transparent p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Sparkles className="size-4 text-primary" /> Ask your data
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ask a question about sales, products, customers, inventory or marketing.
      </p>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Which products should I restock?"
          maxLength={300}
          disabled={busy}
        />
        <Button type="submit" disabled={busy || q.trim().length < 2} className="gap-1.5">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Ask
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => {
              setQ(s);
              ask(s);
            }}
            className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {answer && (
        <div className="mt-4 rounded-xl border bg-background p-4">
          <div className="mb-1.5 flex items-center gap-2">
            <Badge variant={answer.ai ? "default" : "secondary"} className="text-[10px]">
              {answer.ai ? "AI answer" : "From your data"}
            </Badge>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{answer.text}</p>
        </div>
      )}
    </div>
  );
}
