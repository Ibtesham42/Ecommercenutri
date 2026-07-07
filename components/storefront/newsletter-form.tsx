"use client";

import { useState } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";

/**
 * Working newsletter signup for the deep-green footer band (and any other
 * dark surface). Optimistic, rate-limited server-side, idempotent — and the
 * success state replaces the form so the moment feels settled, not reset.
 */
export function NewsletterForm({ source = "footer" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state !== "idle") return;
    setState("busy");
    const res = await subscribeToNewsletter({ email, source });
    if (res.ok) {
      setState("done");
    } else {
      setState("idle");
      toast.error(res.error);
    }
  }

  if (state === "done") {
    return (
      <div className="flex h-12 w-full max-w-md items-center gap-2.5 rounded-xl border border-gold/40 bg-gold/10 px-4 text-sm font-medium text-surface-deep-foreground motion-safe:animate-fade-in">
        <CheckCircle2 className="size-4 shrink-0 text-gold" />
        You&apos;re on the list — welcome to the Nutriyet family.
      </div>
    );
  }

  // Scope the input id by source — the form can appear twice on one page
  // (e.g. a blog CTA band plus the footer).
  const inputId = `newsletter-${source}`;

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md items-center gap-2">
      <label htmlFor={inputId} className="sr-only">
        Email address
      </label>
      <input
        id={inputId}
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email address"
        className="h-12 flex-1 rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-surface-deep-foreground placeholder:text-surface-deep-foreground/50 outline-none transition focus:border-gold/60 focus:ring-2 focus:ring-gold/30"
      />
      <button
        type="submit"
        disabled={state === "busy"}
        className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-bold text-gold-foreground transition-transform hover:brightness-105 active:scale-95 disabled:opacity-70"
      >
        Subscribe
        {state === "busy" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
      </button>
    </form>
  );
}
