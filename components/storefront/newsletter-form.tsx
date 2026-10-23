"use client";

import { useState } from "react";
import { Send, Loader2, CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";
import { cn } from "@/lib/utils";

/**
 * Working newsletter signup for the deep-green footer band (and any other
 * dark surface). Optimistic, rate-limited server-side, idempotent — and the
 * success state replaces the form so the moment feels settled, not reset.
 * `tone="light"` restyles it for a cream card (the footer's newsletter card);
 * behaviour is identical.
 */
export function NewsletterForm({
  source = "footer",
  tone = "dark",
}: {
  source?: string;
  tone?: "dark" | "light";
}) {
  const light = tone === "light";
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
      <div
        className={cn(
          "flex h-12 w-full max-w-md items-center gap-2.5 rounded-xl border px-4 text-sm font-medium motion-safe:animate-fade-in",
          light
            ? "border-primary/20 bg-sage text-sage-foreground"
            : "border-gold/40 bg-gold/10 text-surface-deep-foreground",
        )}
      >
        <CheckCircle2 className={cn("size-4 shrink-0", light ? "text-primary" : "text-gold")} />
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
      <div className="relative min-w-0 flex-1">
        {light && (
          <Mail
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground"
          />
        )}
        <input
          id={inputId}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          className={cn(
            "h-12 w-full rounded-xl border px-4 text-sm outline-none transition",
            light
              ? "border-input bg-card pl-11 text-foreground placeholder:text-muted-foreground/75 focus:border-primary focus:ring-3 focus:ring-primary/15"
              : "border-white/15 bg-white/5 text-surface-deep-foreground placeholder:text-surface-deep-foreground/50 focus:border-gold/60 focus:ring-2 focus:ring-gold/30",
          )}
        />
      </div>
      <button
        type="submit"
        disabled={state === "busy"}
        className={cn(
          "inline-flex h-12 shrink-0 items-center gap-2 rounded-xl px-5 text-sm max-sm:px-4 font-bold transition-transform motion-safe:active:scale-95 disabled:opacity-70",
          light
            ? "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            : "bg-gold text-gold-foreground hover:brightness-105",
        )}
      >
        Subscribe
        {state === "busy" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className={cn("size-4", light && "max-sm:hidden")} />
        )}
      </button>
    </form>
  );
}
