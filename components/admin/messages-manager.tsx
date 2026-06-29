"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Trash2,
  Inbox,
  Search,
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
  CornerDownRight,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BulkBar, type BulkAction } from "@/components/admin/bulk/bulk-bar";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import { toastBulk } from "@/lib/admin/run-bulk";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  replyToMessage,
  setMessageStatus,
  deleteContactMessage,
  bulkMessageAction,
} from "@/lib/actions/admin/messages";

const BULK_ACTIONS: BulkAction[] = [
  { key: "close", label: "Mark closed", icon: CheckCheck },
  {
    key: "delete",
    label: "Delete",
    icon: Trash2,
    destructive: true,
    confirm: {
      title: "Delete selected conversations?",
      description: "This permanently removes the selected messages and their replies. This cannot be undone.",
      actionLabel: "Delete",
    },
  },
];
const BULK_VERB: Record<string, string> = { close: "closed", delete: "deleted" };

type Status = "NEW" | "IN_PROGRESS" | "REPLIED" | "CLOSED";

export type ReplyRow = {
  id: string;
  body: string;
  adminName: string | null;
  delivered: boolean;
  error: string | null;
  createdAt: string;
};

export type MessageRow = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: Status;
  createdAt: string;
  replies: ReplyRow[];
};

const STATUS_META: Record<Status, { label: string; className: string }> = {
  NEW: { label: "New", className: "bg-primary text-primary-foreground" },
  IN_PROGRESS: { label: "In Progress", className: "bg-amber-500 text-white" },
  REPLIED: { label: "Replied", className: "bg-sky-600 text-white" },
  CLOSED: { label: "Closed", className: "bg-muted text-muted-foreground" },
};

const FILTERS: { key: Status | "ALL"; label: string }[] = [
  { key: "NEW", label: "New" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "REPLIED", label: "Replied" },
  { key: "CLOSED", label: "Closed" },
  { key: "ALL", label: "All" },
];

// Optional canned responses an admin can drop into a reply.
const TEMPLATES: { title: string; body: string }[] = [
  {
    title: "Thanks for reaching out",
    body: "Thank you for getting in touch with us. We've received your message and are happy to help. ",
  },
  {
    title: "Order status",
    body: "Thanks for your patience! Your order is being processed and you'll receive a tracking update by email as soon as it ships. You can also track it any time at /track.",
  },
  {
    title: "Shipping & returns",
    body: "Most orders are delivered within 3–7 business days, with free shipping over ₹499. For damaged or incorrect items, just reply within 48 hours of delivery and we'll arrange a replacement or refund.",
  },
  {
    title: "Resolved — anything else?",
    body: "We hope that resolves your query! If there's anything else we can help with, just reply to this email. ",
  },
];

export function MessagesManager({ messages }: { messages: MessageRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Status | "ALL">("NEW");
  const [query, setQuery] = useState("");
  const [replyFor, setReplyFor] = useState<MessageRow | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: messages.length };
    for (const m of messages) c[m.status] = (c[m.status] ?? 0) + 1;
    return c;
  }, [messages]);

  const shown = useMemo(() => {
    const byFilter = filter === "ALL" ? messages : messages.filter((m) => m.status === filter);
    const q = query.trim().toLowerCase();
    if (!q) return byFilter;
    return byFilter.filter((m) =>
      [m.name, m.email, m.subject ?? "", m.message].some((f) => f.toLowerCase().includes(q)),
    );
  }, [messages, filter, query]);

  const sel = useBulkSelection(shown.map((m) => m.id));
  const [bulkPending, startBulk] = useTransition();

  function runBulk(key: string) {
    startBulk(async () => {
      const res = await bulkMessageAction(sel.selectedIds, key as "close" | "delete");
      if (toastBulk(res, BULK_VERB[key] ?? "updated")) {
        sel.clear();
        router.refresh();
      }
    });
  }

  function changeStatus(id: string, status: Status) {
    setMessageStatus(id, status).then((res) => {
      if (res.ok) {
        toast.success(`Marked ${STATUS_META[status].label}`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this conversation? This cannot be undone.")) return;
    deleteContactMessage(id).then((res) => {
      if (res.ok) {
        toast.success("Conversation deleted");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent",
              )}
            >
              {f.label} ({counts[f.key] ?? 0})
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages…"
            className="pl-9"
            aria-label="Search messages"
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Inbox className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 font-medium">No messages here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Messages sent from the storefront contact form appear here.
          </p>
        </div>
      ) : (
        <>
          <label className="flex w-fit items-center gap-2 px-1 text-sm text-muted-foreground">
            <Checkbox
              aria-label="Select all"
              checked={sel.allSelected ? true : sel.someSelected ? "indeterminate" : false}
              onCheckedChange={() => sel.toggleAll()}
            />
            Select all ({shown.length})
          </label>
          <ul className="space-y-3">
            {shown.map((m) => (
            <li
              key={m.id}
              className="rounded-xl border bg-background p-4 shadow-elev-1 data-[state=selected]:border-primary/50 data-[state=selected]:ring-1 data-[state=selected]:ring-primary/30"
              data-state={sel.isSelected(m.id) ? "selected" : undefined}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 gap-3">
                  <Checkbox
                    aria-label={`Select message from ${m.name}`}
                    checked={sel.isSelected(m.id)}
                    onCheckedChange={() => sel.toggle(m.id)}
                    className="mt-1"
                  />
                  <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{m.name}</p>
                    <Badge className={cn("border-transparent", STATUS_META[m.status].className)}>
                      {STATUS_META[m.status].label}
                    </Badge>
                  </div>
                  <a href={`mailto:${m.email}`} className="text-sm text-primary hover:underline">
                    {m.email}
                  </a>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(m.createdAt)}
                </span>
              </div>

              {m.subject && <p className="mt-2 text-sm font-medium">{m.subject}</p>}
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{m.message}</p>

              {/* Conversation history */}
              {m.replies.length > 0 && (
                <ul className="mt-3 space-y-2 border-l-2 border-primary/30 pl-3">
                  {m.replies.map((r) => (
                    <li key={r.id} className="rounded-lg bg-accent/40 p-3 text-sm">
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <CornerDownRight className="size-3.5" />
                        <span className="font-medium text-foreground">{r.adminName ?? "Admin"}</span>
                        <span>· {formatDateTime(r.createdAt)}</span>
                        {r.delivered ? (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <CheckCircle2 className="size-3.5" /> Delivered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <AlertCircle className="size-3.5" /> Not delivered
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap">{r.body}</p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" className="gap-1.5" onClick={() => setReplyFor(m)}>
                  <Mail className="size-4" /> Reply
                </Button>
                <select
                  value={m.status}
                  onChange={(e) => changeStatus(m.id, e.target.value as Status)}
                  aria-label="Change status"
                  className="h-8 rounded-md border bg-transparent px-2 text-sm"
                >
                  <option value="NEW">New</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="REPLIED">Replied</option>
                  <option value="CLOSED">Closed</option>
                </select>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(m.id)}
                >
                  <Trash2 className="size-4" /> Delete
                </Button>
              </div>
            </li>
          ))}
          </ul>
        </>
      )}

      <BulkBar
        count={sel.count}
        actions={BULK_ACTIONS}
        onRun={runBulk}
        onClear={sel.clear}
        pending={bulkPending}
      />

      <ReplyDialog
        message={replyFor}
        onClose={() => setReplyFor(null)}
        onSent={() => {
          setReplyFor(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function ReplyDialog({
  message,
  onClose,
  onSent,
}: {
  message: MessageRow | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  // Reset the draft whenever a different message is opened.
  const [forId, setForId] = useState<string | null>(null);
  if (message && message.id !== forId) {
    setForId(message.id);
    setBody("");
  }

  async function send() {
    if (!message) return;
    setSending(true);
    const res = await replyToMessage(message.id, body);
    setSending(false);
    if (res.ok) {
      toast.success("Reply sent ✓");
      onSent();
    } else {
      // Reply may still be saved even if delivery failed — surface the detail.
      toast.error(res.error);
      onSent();
    }
  }

  return (
    <Dialog open={message != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        {message && (
          <>
            <DialogHeader>
              <DialogTitle>Reply to {message.name}</DialogTitle>
              <DialogDescription>
                Sends an email to <span className="font-medium">{message.email}</span> via your
                configured email service.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                {message.subject && <p className="font-medium">{message.subject}</p>}
                <p className="whitespace-pre-wrap text-muted-foreground">{message.message}</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Your reply</span>
                  <select
                    aria-label="Insert a template"
                    className="h-8 rounded-md border bg-transparent px-2 text-xs"
                    value=""
                    onChange={(e) => {
                      const t = TEMPLATES[Number(e.target.value)];
                      if (t) setBody((b) => (b ? `${b}\n\n${t.body}` : t.body));
                      e.target.value = "";
                    }}
                  >
                    <option value="">Insert template…</option>
                    {TEMPLATES.map((t, i) => (
                      <option key={t.title} value={i}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
                <Textarea
                  rows={7}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={`Hi ${message.name}, thanks for reaching out…`}
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose} disabled={sending}>
                  Cancel
                </Button>
                <Button onClick={send} disabled={sending || body.trim().length < 2} className="gap-2">
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Send reply
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
