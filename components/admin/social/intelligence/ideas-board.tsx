"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star, X, Wand2, Clock, Users } from "lucide-react";
import type { ContentIdea } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { updateIdeaStatus, createDraftFromIdea } from "@/lib/actions/admin/intelligence";
import {
  IDEA_FORMAT_LABEL,
  IDEA_DIFFICULTY_LABEL,
  IDEA_STATUS_LABEL,
  IDEA_SCORE_DIMENSIONS,
  type IdeaScores,
} from "@/lib/intelligence/catalog";

const FILTERS = ["ALL", "SUGGESTED", "SHORTLISTED", "USED", "DISMISSED"] as const;

export function IdeasBoard({
  ideas,
  minScore,
}: {
  ideas: ContentIdea[];
  minScore: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");

  const visible = useMemo(
    () => (filter === "ALL" ? ideas : ideas.filter((i) => i.status === filter)),
    [ideas, filter],
  );

  const setStatus = (id: string, status: "SHORTLISTED" | "DISMISSED" | "SUGGESTED") =>
    start(async () => {
      const res = await updateIdeaStatus({ id, status });
      if (res.ok) {
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't update.");
      }
    });

  const use = (id: string) =>
    start(async () => {
      toast.info("Writing a fresh draft from this idea…");
      const res = await createDraftFromIdea(id);
      if (res.ok) {
        toast.success("Draft created in the Queue.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't create the draft.");
      }
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setFilter(f)}
          >
            {f === "ALL" ? "All" : IDEA_STATUS_LABEL[f]}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No ideas here yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Run &ldquo;Generate ideas&rdquo; on the Intelligence dashboard to get today&apos;s batch.
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {visible.map((idea) => {
            const recommended = idea.totalScore >= minScore;
            const scores = (idea.scores ?? {}) as Partial<IdeaScores>;
            return (
              <div
                key={idea.id}
                className={cn(
                  "rounded-xl border bg-card p-4 shadow-elev-1",
                  idea.status === "DISMISSED" && "opacity-55",
                )}
              >
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
                          recommended ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}
                        title={`Content score: ${idea.totalScore}/100`}
                      >
                        {idea.totalScore}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium leading-snug">{idea.topic}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-[10px]">
                            {IDEA_FORMAT_LABEL[idea.format]}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {IDEA_DIFFICULTY_LABEL[idea.difficulty]}
                          </Badge>
                          {recommended && (
                            <Badge variant="outline" className="border-gold/50 bg-gold/10 text-[10px] text-gold">
                              Recommended
                            </Badge>
                          )}
                          {idea.status !== "SUGGESTED" && (
                            <Badge variant="outline" className="text-[10px]">
                              {IDEA_STATUS_LABEL[idea.status]}
                            </Badge>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-3" /> {idea.audience}
                          </span>
                          {idea.bestTime && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="size-3" /> {idea.bestTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{idea.rationale}</p>
                    {idea.cta && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Suggested CTA: <span className="text-foreground">{idea.cta}</span>
                      </p>
                    )}
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">
                        Score breakdown
                      </summary>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {IDEA_SCORE_DIMENSIONS.map((d) => (
                          <span key={d.key} className="text-muted-foreground">
                            {d.label}: <span className="font-medium text-foreground">{scores[d.key] ?? "—"}</span>
                          </span>
                        ))}
                        <span className="text-muted-foreground">
                          Engagement potential:{" "}
                          <span className="font-medium text-foreground">{idea.engagementPotential}</span>
                        </span>
                      </div>
                    </details>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {idea.status !== "USED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={pending}
                        onClick={() => use(idea.id)}
                        title="Create an original draft in the AI Marketing queue"
                      >
                        <Wand2 className="mr-1.5 size-3.5" /> Use
                      </Button>
                    )}
                    {idea.status !== "SHORTLISTED" && idea.status !== "USED" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label="Shortlist"
                        disabled={pending}
                        onClick={() => setStatus(idea.id, "SHORTLISTED")}
                      >
                        <Star className="size-4" />
                      </Button>
                    )}
                    {idea.status !== "DISMISSED" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label="Dismiss"
                        disabled={pending}
                        onClick={() => setStatus(idea.id, "DISMISSED")}
                      >
                        <X className="size-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label="Restore"
                        disabled={pending}
                        onClick={() => setStatus(idea.id, "SUGGESTED")}
                      >
                        <Star className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
