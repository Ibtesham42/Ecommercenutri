"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Sparkles, Copy, Check, RotateCcw, ArrowRight, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoreGauge } from "@/components/storefront/quiz/score-gauge";
import type { MyHealthScore } from "@/lib/queries/quiz";

/** "My Health Score" dashboard card — the full unlocked report + welcome coupon. */
export function MyHealthScoreCard({ data }: { data: MyHealthScore }) {
  const [copied, setCopied] = useState(false);
  const r = data.recommendations;

  function copyCoupon() {
    if (!data.couponCode) return;
    navigator.clipboard?.writeText(data.couponCode).then(
      () => {
        setCopied(true);
        toast.success("Coupon copied — apply it at checkout.");
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("Couldn't copy. Please copy it manually."),
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-elev-1">
      <div className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <ScoreGauge score={data.score} band={data.band} size={148} />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h2 className="flex items-center justify-center gap-2 font-heading text-lg font-semibold sm:justify-start">
            <Sparkles className="size-4 text-primary" /> My Health Score
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{r.summary}</p>
        </div>
      </div>

      {data.couponCode && (
        <div className="mx-5 mb-5 flex flex-col items-center justify-between gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 sm:mx-6 sm:flex-row">
          <div className="flex items-center gap-2 text-sm">
            <Gift className="size-4 text-primary" />
            <span>
              Your welcome coupon:{" "}
              <span className="font-mono text-base font-bold tracking-wider text-primary">{data.couponCode}</span>
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={copyCoupon} className="gap-1.5">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy code"}
          </Button>
        </div>
      )}

      {r.tips.length > 0 && (
        <div className="border-t p-5 sm:p-6">
          <h3 className="mb-3 text-sm font-semibold">Your personalized tips</h3>
          <ul className="space-y-2">
            {r.tips.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.focus.length > 0 && (
        <div className="border-t p-5 sm:p-6">
          <h3 className="mb-3 text-sm font-semibold">Snacks picked for you</h3>
          <div className="flex flex-wrap gap-2">
            {r.focus.map((f) => (
              <Link
                key={f.label}
                href={f.href}
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3.5 py-1.5 text-sm font-medium shadow-elev-1 transition-colors hover:border-primary/50 hover:text-primary"
              >
                {f.label} <ArrowRight className="size-3.5" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3 sm:px-6">
        <span className="text-xs text-muted-foreground">Taken {new Date(data.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href="/quiz"><RotateCcw className="size-3.5" /> Retake</Link>
        </Button>
      </div>
    </div>
  );
}
