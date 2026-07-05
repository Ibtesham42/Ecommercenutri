"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Copy, Download, ExternalLink, Link2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SURVEY_QUESTIONS, surveyQuestion } from "@/lib/survey";
import type { SurveyStats } from "@/lib/queries/survey";
import { cn } from "@/lib/utils";

export type SurveyRow = {
  id: string;
  createdAt: string;
  ageGroup: string;
  gender: string;
  occupation: string;
  occupationOther: string | null;
  city: string | null;
  snackFrequency: string;
  snacks: string[];
  snacksOther: string | null;
  snackPriority: string;
  makhanaEaten: string;
  makhanaAware: string;
  makhanaForms: string[];
  makhanaBarriers: string[];
  makhanaBarrierOther: string | null;
  buyPlaces: string[];
  packSize: string;
  flavours: string[];
  flavourOther: string | null;
  learnInterest: string;
  topics: string[];
  wantsUpdates: string;
  contactName: string | null;
  contactMobile: string | null;
  contactEmail: string | null;
};

/** English option label for compact admin display. */
function enLabel(qid: string, key: string): string {
  return surveyQuestion(qid)?.options?.find((o) => o.key === key)?.en ?? key;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-elev-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SurveyDashboard({
  stats,
  responses,
  surveyUrl,
}: {
  stats: SurveyStats;
  responses: SurveyRow[];
  surveyUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(surveyUrl);
      setCopied(true);
      toast.success("Survey link copied — share it anywhere.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select the link text and copy manually.");
    }
  }

  const maxDay = Math.max(1, ...stats.byDay.map((d) => d.count));

  return (
    <div className="space-y-5">
      {/* Share link — the ONLY place the survey is linked. */}
      <div className="rounded-2xl border bg-card p-4 shadow-elev-1 sm:p-5">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <Link2 className="size-4 text-primary" /> Share the survey
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The survey is link-only — it is not linked anywhere on the website. Copy this link and
          send it on WhatsApp, SMS, email or print it as a QR.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-xl border bg-accent/30 px-3 py-2.5 text-sm">
            {surveyUrl}
          </code>
          <Button onClick={copyLink} className="shrink-0">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button asChild variant="outline" className="shrink-0">
            <Link href="/survey" target="_blank">
              <ExternalLink className="size-4" /> Open
            </Link>
          </Button>
          <Button asChild variant="outline" className="shrink-0">
            <a href="/admin/survey/export">
              <Download className="size-4" /> Export CSV
            </a>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total responses" value={String(stats.total)} />
        <StatCard label="Last 7 days" value={String(stats.last7d)} />
        <StatCard
          label="Opted into updates"
          value={String(stats.optIns)}
          hint={stats.total > 0 ? `${Math.round((stats.optIns / stats.total) * 100)}% of respondents` : undefined}
        />
        <StatCard
          label="Cities / districts"
          value={String(stats.topCities.length)}
          hint={stats.topCities[0] ? `Top: ${stats.topCities[0].city}` : undefined}
        />
      </div>

      {/* Responses over time */}
      {stats.byDay.length > 0 && (
        <div className="rounded-2xl border bg-card p-4 shadow-elev-1 sm:p-5">
          <h3 className="mb-3 font-heading text-base font-semibold">Responses over time</h3>
          <div className="flex h-24 items-end gap-1">
            {stats.byDay.map((d) => (
              <div
                key={d.day}
                title={`${d.day}: ${d.count}`}
                className="min-w-1.5 flex-1 rounded-t bg-primary/70"
                style={{ height: `${Math.max(6, (d.count / maxDay) * 100)}%` }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{stats.byDay[0]?.day}</span>
            <span>{stats.byDay[stats.byDay.length - 1]?.day}</span>
          </div>
        </div>
      )}

      {/* Per-question statistics */}
      <div className="grid gap-4 lg:grid-cols-2">
        {stats.questions.map((q) => {
          const def = surveyQuestion(q.id);
          if (!def) return null;
          return (
            <div key={q.id} className="rounded-2xl border bg-card p-4 shadow-elev-1 sm:p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold leading-snug">
                  Q{q.num}. {def.en}
                </h3>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {q.type === "multi" ? "multi" : "single"} · {q.answered} answered
                </Badge>
              </div>
              <div className="space-y-2">
                {q.options.map((o) => (
                  <div key={o.key}>
                    <div className="mb-0.5 flex items-center justify-between text-xs">
                      <span className="truncate">{enLabel(q.id, o.key)}</span>
                      <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
                        {o.count} · {o.pct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-accent">
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${o.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Top cities */}
      {stats.topCities.length > 0 && (
        <div className="rounded-2xl border bg-card p-4 shadow-elev-1 sm:p-5">
          <h3 className="mb-3 font-heading text-base font-semibold">Top cities / districts</h3>
          <div className="flex flex-wrap gap-2">
            {stats.topCities.map((c) => (
              <Badge key={c.city} variant="secondary" className="text-xs">
                {c.city} · {c.count}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Raw responses */}
      <div className="rounded-2xl border bg-card p-4 shadow-elev-1 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-heading text-base font-semibold">
            <Users className="size-4 text-primary" /> Responses
            <span className="text-xs font-normal text-muted-foreground">
              (latest {responses.length}
              {stats.total > responses.length ? ` of ${stats.total} — export CSV for all` : ""})
            </span>
          </h3>
        </div>
        {responses.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No responses yet. Copy the link above and share it to start collecting data.
          </p>
        ) : (
          <ul className="divide-y">
            {responses.map((r) => (
              <li key={r.id}>
                <details className="group py-2.5">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm marker:content-none">
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    <span>{enLabel("ageGroup", r.ageGroup)}</span>
                    <span className="text-muted-foreground">{enLabel("gender", r.gender)}</span>
                    {r.city && <span className="text-muted-foreground">{r.city}</span>}
                    {r.wantsUpdates === "yes" && (
                      <Badge className="text-[10px]" variant="secondary">
                        Opted in{r.contactName ? ` · ${r.contactName}` : ""}
                      </Badge>
                    )}
                    <span className="ml-auto text-xs text-primary group-open:hidden">
                      View answers
                    </span>
                  </summary>
                  <dl className="mt-2 grid gap-x-6 gap-y-1.5 rounded-xl bg-accent/30 p-3 text-xs sm:grid-cols-2">
                    {SURVEY_QUESTIONS.filter((q) => q.type !== "text").map((q) => {
                      const v = r[q.id as keyof SurveyRow];
                      const text = Array.isArray(v)
                        ? v.map((k) => enLabel(q.id, k)).join(", ")
                        : typeof v === "string" && v
                          ? enLabel(q.id, v)
                          : "—";
                      return (
                        <div key={q.id} className="min-w-0">
                          <dt className="font-medium text-muted-foreground">
                            Q{q.num}. {q.en}
                          </dt>
                          <dd className={cn("truncate", text === "—" && "text-muted-foreground")}>
                            {text}
                          </dd>
                        </div>
                      );
                    })}
                    {r.city && (
                      <div>
                        <dt className="font-medium text-muted-foreground">Q4. City / District</dt>
                        <dd>{r.city}</dd>
                      </div>
                    )}
                    {(r.occupationOther || r.snacksOther || r.makhanaBarrierOther || r.flavourOther) && (
                      <div className="sm:col-span-2">
                        <dt className="font-medium text-muted-foreground">Other (free text)</dt>
                        <dd>
                          {[r.occupationOther, r.snacksOther, r.makhanaBarrierOther, r.flavourOther]
                            .filter(Boolean)
                            .join(" · ")}
                        </dd>
                      </div>
                    )}
                    {r.wantsUpdates === "yes" && (
                      <div className="sm:col-span-2">
                        <dt className="font-medium text-muted-foreground">Contact</dt>
                        <dd>
                          {[r.contactName, r.contactMobile, r.contactEmail].filter(Boolean).join(" · ") ||
                            "Not provided"}
                        </dd>
                      </div>
                    )}
                  </dl>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
