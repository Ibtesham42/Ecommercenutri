"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailOpen, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { bulkNotificationAction, deleteNotification } from "@/lib/actions/admin/notifications";
import { formatDateTime } from "@/lib/format";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  recipient: string;
  read: boolean;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  RETURN_UPDATE: "Return",
  ORDER_UPDATE: "Order",
  AFFILIATE_UPDATE: "Affiliate",
  GENERAL: "General",
};

const ACTIONS: BulkAction[] = [
  { key: "read", label: "Mark read", icon: MailOpen },
  { key: "unread", label: "Mark unread", icon: Mail },
  {
    key: "delete",
    label: "Delete",
    icon: Trash2,
    destructive: true,
    confirm: {
      title: "Delete selected notifications?",
      description: "This permanently removes the selected notifications. This cannot be undone.",
      actionLabel: "Delete",
    },
  },
];
const VERB: Record<string, string> = { read: "marked read", unread: "marked unread", delete: "deleted" };

export function NotificationTable({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const sel = useBulkSelection(notifications.map((n) => n.id));
  const [pending, startTransition] = useTransition();

  function run(key: string) {
    startTransition(async () => {
      const res = await bulkNotificationAction(sel.selectedIds, key as "read" | "unread" | "delete");
      if (toastBulk(res, VERB[key] ?? "updated")) {
        sel.clear();
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this notification?")) return;
    startTransition(async () => {
      const res = await deleteNotification(id);
      if (res.ok) {
        toast.success("Notification deleted");
        router.refresh();
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
            <TableHead>Notification</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {notifications.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                No notifications found.
              </TableCell>
            </TableRow>
          ) : (
            notifications.map((n) => (
              <TableRow key={n.id} data-state={sel.isSelected(n.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${n.title}`}
                    checked={sel.isSelected(n.id)}
                    onCheckedChange={() => sel.toggle(n.id)}
                  />
                </TableCell>
                <TableCell className="max-w-[320px]">
                  <p className={n.read ? "font-medium" : "font-semibold"}>{n.title}</p>
                  {n.body && <p className="line-clamp-1 text-xs text-muted-foreground">{n.body}</p>}
                </TableCell>
                <TableCell className="max-w-[180px] truncate text-muted-foreground">{n.recipient}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{TYPE_LABEL[n.type] ?? n.type}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDateTime(n.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant={n.read ? "secondary" : "default"}>{n.read ? "Read" : "Unread"}</Badge>
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remove(n.id)}
                    disabled={pending}
                    aria-label="Delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <BulkBar count={sel.count} actions={ACTIONS} onRun={run} onClear={sel.clear} pending={pending} />
    </div>
  );
}
