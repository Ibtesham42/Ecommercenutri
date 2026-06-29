"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal, Pencil, Copy, Send, RefreshCw, Ban, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BulkBar, type BulkAction } from "@/components/admin/bulk/bulk-bar";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import { toastBulk } from "@/lib/admin/run-bulk";
import {
  bulkCampaignAction,
  sendCampaign,
  cancelCampaign,
  duplicateCampaign,
  resendCampaign,
  deleteCampaign,
} from "@/lib/actions/admin/marketing";
import { formatPrice, formatDateTime } from "@/lib/format";
import { CHANNEL_LABEL, STATUS_LABEL, STATUS_VARIANT, RECURRENCE_LABEL, type Recurrence } from "@/lib/marketing/channels";
import type { CampaignStatus, CampaignChannel } from "@prisma/client";

export type CampaignRow = {
  id: string;
  name: string;
  title: string;
  status: CampaignStatus;
  channels: CampaignChannel[];
  audienceSize: number;
  sentCount: number;
  deliveredCount: number;
  openCount: number;
  clickCount: number;
  conversionCount: number;
  revenue: number;
  recurrence: string | null;
  scheduledFor: string | null;
  sentAt: string | null;
  createdAt: string;
};

const BULK_ACTIONS: BulkAction[] = [
  { key: "cancel", label: "Cancel", icon: Ban },
  {
    key: "delete",
    label: "Delete",
    icon: Trash2,
    destructive: true,
    confirm: {
      title: "Delete selected campaigns?",
      description: "This permanently removes the selected campaigns and their stats. This cannot be undone.",
      actionLabel: "Delete",
    },
  },
];
const BULK_VERB: Record<string, string> = { cancel: "cancelled", delete: "deleted" };

export function CampaignList({ campaigns }: { campaigns: CampaignRow[] }) {
  const router = useRouter();
  const sel = useBulkSelection(campaigns.map((c) => c.id));
  const [pending, startTransition] = useTransition();

  function runBulk(key: string) {
    startTransition(async () => {
      const res = await bulkCampaignAction(sel.selectedIds, key as "delete" | "cancel");
      if (toastBulk(res, BULK_VERB[key] ?? "updated")) {
        sel.clear();
        router.refresh();
      }
    });
  }

  function act(p: Promise<{ ok: boolean; error?: string }>, ok: string) {
    startTransition(async () => {
      const res = await p;
      if (res.ok) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function send(id: string) {
    if (!confirm("Send this campaign now? Messages go out immediately.")) return;
    act(sendCampaign(id), "Campaign sent");
  }
  function resend(id: string) {
    if (!confirm("Resend? This duplicates the campaign and sends it again now.")) return;
    act(resendCampaign(id), "Campaign resent");
  }
  function remove(id: string) {
    if (!confirm("Delete this campaign?")) return;
    act(deleteCampaign(id), "Campaign deleted");
  }
  function duplicate(id: string) {
    startTransition(async () => {
      const res = await duplicateCampaign(id);
      if (res.ok) {
        toast.success("Duplicated — opening draft");
        router.push(`/admin/marketing/compose/${res.data!.id}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="rounded-xl border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label="Select all"
                checked={sel.allSelected ? true : sel.someSelected ? "indeterminate" : false}
                onCheckedChange={() => sel.toggleAll()}
              />
            </TableHead>
            <TableHead>Campaign</TableHead>
            <TableHead>Channels</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Performance</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                No campaigns yet.
              </TableCell>
            </TableRow>
          ) : (
            campaigns.map((c) => {
              const editable = c.status === "DRAFT" || c.status === "SCHEDULED";
              return (
                <TableRow key={c.id} data-state={sel.isSelected(c.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${c.name}`}
                      checked={sel.isSelected(c.id)}
                      onCheckedChange={() => sel.toggle(c.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium">{c.name}</p>
                      {c.recurrence && c.recurrence !== "NONE" && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <RefreshCw className="size-3" />
                          {RECURRENCE_LABEL[c.recurrence as Recurrence]}
                        </Badge>
                      )}
                    </div>
                    <p className="max-w-[260px] truncate text-xs text-muted-foreground">{c.title}</p>
                    {c.status === "SCHEDULED" && c.scheduledFor && (
                      <p className="text-[11px] text-primary">
                        {c.recurrence && c.recurrence !== "NONE" ? "Next " : "Scheduled "}
                        {formatDateTime(c.scheduledFor)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.channels.map((ch) => (
                        <Badge key={ch} variant="secondary" className="text-[10px]">
                          {CHANNEL_LABEL[ch]}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.status === "SENT" ? (
                      <span>
                        {c.sentCount} sent · {c.openCount} opens · {c.clickCount} clicks
                        {c.revenue > 0 && <> · {formatPrice(c.revenue)}</>}
                      </span>
                    ) : c.audienceSize > 0 ? (
                      <span>{c.audienceSize} reach</span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Actions" disabled={pending}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {editable && (
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/marketing/compose/${c.id}`}>
                              <Pencil className="size-4" /> Edit
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {editable && (
                          <DropdownMenuItem onClick={() => send(c.id)}>
                            <Send className="size-4" /> Send now
                          </DropdownMenuItem>
                        )}
                        {c.status === "SENT" && (
                          <DropdownMenuItem onClick={() => resend(c.id)}>
                            <RefreshCw className="size-4" /> Resend
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => duplicate(c.id)}>
                          <Copy className="size-4" /> Duplicate
                        </DropdownMenuItem>
                        {c.status === "SCHEDULED" && (
                          <DropdownMenuItem onClick={() => act(cancelCampaign(c.id), "Campaign cancelled")}>
                            <Ban className="size-4" /> Cancel schedule
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => remove(c.id)}>
                          <Trash2 className="size-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <BulkBar count={sel.count} actions={BULK_ACTIONS} onRun={runBulk} onClear={sel.clear} pending={pending} />
    </div>
  );
}
