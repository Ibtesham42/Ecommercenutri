"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Check,
  X,
  RefreshCw,
  Pencil,
  Send,
  Trash2,
  ExternalLink,
  Copy,
} from "lucide-react";
import type { SocialPostRow } from "@/lib/queries/social";
import { PILLAR_LABEL, DAYPART_LABEL } from "@/lib/social/strategy";
import { POST_STATUS_LABEL, POST_STATUS_VARIANT } from "@/lib/social/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import { PostEditDialog } from "@/components/admin/social/post-edit-dialog";
import {
  approveSocialPost,
  rejectSocialPost,
  deleteSocialPost,
  regenerateSocialPost,
  publishSocialPostNow,
  bulkSocialPostAction,
} from "@/lib/actions/admin/social";

type Context = "queue" | "scheduled" | "published" | "failed";

function fmt(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function PostTable({
  posts,
  context,
  emptyHint,
}: {
  posts: SocialPostRow[];
  context: Context;
  emptyHint: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<SocialPostRow | null>(null);
  const ids = posts.map((p) => p.id);
  const sel = useBulkSelection(ids);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });

  const runBulk = (action: "approve" | "reject" | "delete") =>
    start(async () => {
      const res = await bulkSocialPostAction(sel.selectedIds, action);
      if (res.ok) {
        toast.success(`${res.data?.done ?? 0} updated${res.data?.skipped ? `, ${res.data.skipped} skipped` : ""}.`);
        sel.clear();
        router.refresh();
      } else {
        toast.error(res.error ?? "Bulk action failed.");
      }
    });

  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="font-medium">Nothing here yet</p>
        <p className="mt-1 text-sm text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  const showBulk = context !== "published";

  return (
    <div className="space-y-3">
      {showBulk && sel.count > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{sel.count} selected</span>
          {context !== "scheduled" && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => runBulk("approve")}>
              Approve &amp; schedule
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={pending} onClick={() => runBulk("reject")}>
            Cancel
          </Button>
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => runBulk("delete")}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={sel.clear}>
            Clear
          </Button>
        </div>
      )}

      <div className="grid gap-2">
        {posts.map((p) => (
          <div
            key={p.id}
            className="flex items-start gap-3 rounded-xl border p-3 shadow-elev-1"
          >
            {showBulk && (
              <Checkbox
                className="mt-1"
                checked={sel.isSelected(p.id)}
                onCheckedChange={() => sel.toggle(p.id)}
                aria-label="Select post"
              />
            )}
            {p.imageUrls[0] ? (
              <Image
                src={p.imageUrls[0]}
                alt={p.altText || "Post image"}
                width={64}
                height={64}
                className="size-16 shrink-0 rounded-lg object-cover"
                unoptimized
              />
            ) : (
              <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                No image
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={POST_STATUS_VARIANT[p.status]}>{POST_STATUS_LABEL[p.status]}</Badge>
                <span className="text-xs text-muted-foreground">
                  {PILLAR_LABEL[p.pillar]} · {DAYPART_LABEL[p.daypart]}
                </span>
                {p.productName && (
                  <span className="truncate text-xs text-muted-foreground">· {p.productName}</span>
                )}
                {p.imageUrls.length > 1 && (
                  <span className="text-xs text-muted-foreground">· carousel ×{p.imageUrls.length}</span>
                )}
              </div>
              <p className="mt-1 truncate text-sm font-medium">{p.hook || p.caption.split("\n")[0]}</p>
              <p className="line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">{p.caption}</p>
              <p className="mt-1 truncate text-xs text-primary/80">{p.hashtags.join(" ")}</p>
              <div className="mt-1 text-xs text-muted-foreground">
                {context === "published"
                  ? `Published ${fmt(p.publishedAt)}`
                  : p.scheduledFor
                    ? `Scheduled ${fmt(p.scheduledFor)}`
                    : `Created ${fmt(p.createdAt)}`}
                {p.error && <span className="text-destructive"> · {p.error}</span>}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Actions" disabled={pending}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(context === "queue" || context === "failed") && (
                  <DropdownMenuItem onClick={() => run(() => approveSocialPost(p.id), "Approved & scheduled.")}>
                    <Check className="mr-2 size-4" /> Approve &amp; schedule
                  </DropdownMenuItem>
                )}
                {context !== "published" && (
                  <DropdownMenuItem onClick={() => run(() => publishSocialPostNow(p.id), "Published.")}>
                    <Send className="mr-2 size-4" /> Publish now
                  </DropdownMenuItem>
                )}
                {context !== "published" && (
                  <DropdownMenuItem onClick={() => setEditing(p)}>
                    <Pencil className="mr-2 size-4" /> Edit
                  </DropdownMenuItem>
                )}
                {context !== "published" && (
                  <DropdownMenuItem onClick={() => run(() => regenerateSocialPost(p.id), "Regenerated.")}>
                    <RefreshCw className="mr-2 size-4" /> Regenerate copy
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard?.writeText(`${p.caption}\n\n${p.hashtags.join(" ")}`);
                    toast.success("Caption copied.");
                  }}
                >
                  <Copy className="mr-2 size-4" /> Copy caption
                </DropdownMenuItem>
                {p.permalink && (
                  <DropdownMenuItem asChild>
                    <a href={p.permalink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 size-4" /> View on Instagram
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {context !== "published" && (
                  <DropdownMenuItem onClick={() => run(() => rejectSocialPost(p.id), "Cancelled.")}>
                    <X className="mr-2 size-4" /> Cancel
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => run(() => deleteSocialPost(p.id), "Deleted.")}
                >
                  <Trash2 className="mr-2 size-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      <PostEditDialog post={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
