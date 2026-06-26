"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Trash2, Check, Undo2, Inbox, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import {
  markContactMessage,
  deleteContactMessage,
} from "@/lib/actions/admin/messages";

export type MessageRow = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  handled: boolean;
  createdAt: string;
};

export function MessagesManager({ messages }: { messages: MessageRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "new">("new");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const byFilter = filter === "new" ? messages.filter((m) => !m.handled) : messages;
    const q = query.trim().toLowerCase();
    if (!q) return byFilter;
    return byFilter.filter((m) =>
      [m.name, m.email, m.subject ?? "", m.message].some((f) => f.toLowerCase().includes(q)),
    );
  }, [messages, filter, query]);

  function act(p: Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    p.then((res) => {
      if (res.ok) {
        toast.success(okMsg);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <FilterTab active={filter === "new"} onClick={() => setFilter("new")}>
            New ({messages.filter((m) => !m.handled).length})
          </FilterTab>
          <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>
            All ({messages.length})
          </FilterTab>
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
          <p className="mt-3 font-medium">{filter === "new" ? "No new messages" : "No messages yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Messages sent from the storefront contact form appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((m) => (
            <li
              key={m.id}
              className={`rounded-xl border p-4 ${m.handled ? "bg-muted/30" : "bg-background"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{m.name}</p>
                    {!m.handled && <Badge>New</Badge>}
                  </div>
                  <a href={`mailto:${m.email}`} className="text-sm text-primary hover:underline">
                    {m.email}
                  </a>
                </div>
                <span className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
              </div>

              {m.subject && <p className="mt-2 text-sm font-medium">{m.subject}</p>}
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{m.message}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject || "Your message to Nutriyet")}`}>
                    <Mail className="size-4" /> Reply
                  </a>
                </Button>
                {m.handled ? (
                  <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => act(markContactMessage(m.id, false), "Marked as new")}>
                    <Undo2 className="size-4" /> Mark as new
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => act(markContactMessage(m.id, true), "Marked as handled")}>
                    <Check className="size-4" /> Mark handled
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    if (confirm("Delete this message?")) act(deleteContactMessage(m.id), "Message deleted");
                  }}
                >
                  <Trash2 className="size-4" /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}
