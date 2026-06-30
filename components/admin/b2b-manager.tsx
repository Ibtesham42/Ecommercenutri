"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Trash2,
  Eye,
  Phone,
  Mail,
  Copy,
  Download,
  Building2,
  MapPin,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BulkBar, type BulkAction } from "@/components/admin/bulk/bulk-bar";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import { toastBulk } from "@/lib/admin/run-bulk";
import { downloadCsv } from "@/lib/admin/csv-export";
import {
  B2B_STATUSES,
  B2B_STATUS_LABELS,
  B2B_STATUS_CLASS,
  BUSINESS_TYPES,
} from "@/lib/b2b";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { B2BStatus } from "@prisma/client";
import {
  updateB2BStatus,
  deleteB2BInquiry,
  bulkB2BAction,
} from "@/lib/actions/admin/b2b";

export type B2BRow = {
  id: string;
  fullName: string;
  companyName: string | null;
  businessType: string;
  phone: string;
  email: string;
  city: string | null;
  state: string | null;
  country: string | null;
  purpose: string;
  message: string;
  status: B2BStatus;
  createdAt: string;
};

const BULK_ACTIONS: BulkAction[] = [
  {
    key: "delete",
    label: "Delete",
    icon: Trash2,
    destructive: true,
    confirm: {
      title: "Delete selected inquiries?",
      description: "This permanently removes the selected B2B inquiries. This cannot be undone.",
      actionLabel: "Delete",
    },
  },
];

const selectClass = "h-9 rounded-md border bg-transparent px-2 text-sm";

function copy(text: string, label: string) {
  navigator.clipboard
    ?.writeText(text)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error("Copy failed"));
}

export function B2BManager({ inquiries }: { inquiries: B2BRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState<B2BRow | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return inquiries.filter((r) => {
      if (status && r.status !== status) return false;
      if (type && r.businessType !== type) return false;
      if (from && r.createdAt.slice(0, 10) < from) return false;
      if (to && r.createdAt.slice(0, 10) > to) return false;
      if (term) {
        const hay = `${r.fullName} ${r.companyName ?? ""} ${r.email} ${r.phone} ${r.purpose} ${r.city ?? ""} ${r.state ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [inquiries, q, status, type, from, to]);

  const sel = useBulkSelection(filtered.map((r) => r.id));
  const [bulkPending, startBulk] = useTransition();

  function runBulk(key: string) {
    startBulk(async () => {
      const res = await bulkB2BAction(sel.selectedIds, key);
      if (toastBulk(res, key === "delete" ? "deleted" : "updated")) {
        sel.clear();
        router.refresh();
      }
    });
  }

  function setRowStatus(id: string, value: string) {
    void updateB2BStatus(id, value).then((res) => {
      if (res.ok) {
        toast.success("Status updated");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this inquiry?")) return;
    void deleteB2BInquiry(id).then((res) => {
      if (res.ok) {
        toast.success("Inquiry deleted");
        setView(null);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function exportCsv() {
    downloadCsv(
      "b2b-inquiries",
      ["Inquiry ID", "Date", "Name", "Company", "Business Type", "Phone", "Email", "City", "State", "Country", "Purpose", "Message", "Status"],
      filtered.map((r) => [
        r.id,
        new Date(r.createdAt).toLocaleString(),
        r.fullName,
        r.companyName ?? "",
        r.businessType,
        r.phone,
        r.email,
        r.city ?? "",
        r.state ?? "",
        r.country ?? "",
        r.purpose,
        r.message,
        B2B_STATUS_LABELS[r.status],
      ]),
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, company, email, phone…"
            className="pl-8"
          />
        </div>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All status</option>
          {B2B_STATUSES.map((s) => (
            <option key={s} value={s}>
              {B2B_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {BUSINESS_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" aria-label="From date" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" aria-label="To date" />
        <Button variant="outline" className="gap-1.5" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        {filtered.length > 0 ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              aria-label="Select all"
              checked={sel.allSelected ? true : sel.someSelected ? "indeterminate" : false}
              onCheckedChange={() => sel.toggleAll()}
            />
            Select all ({filtered.length})
          </label>
        ) : (
          <span />
        )}
        <span className="text-sm text-muted-foreground">{filtered.length} of {inquiries.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Inbox className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 font-medium">No B2B inquiries</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Business inquiries from the B2B page will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border bg-background p-3 data-[state=selected]:border-primary/60 data-[state=selected]:ring-1 data-[state=selected]:ring-primary/30"
              data-state={sel.isSelected(r.id) ? "selected" : undefined}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  className="mt-1"
                  aria-label={`Select ${r.fullName}`}
                  checked={sel.isSelected(r.id)}
                  onCheckedChange={() => sel.toggle(r.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate font-semibold">{r.fullName}</p>
                    {r.companyName && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="size-3" /> {r.companyName}
                      </span>
                    )}
                    <span className="rounded-full border bg-accent/40 px-2 py-0.5 text-[11px] font-medium">
                      {r.businessType}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.purpose}
                    {(r.city || r.state || r.country) && (
                      <span>
                        {" · "}
                        <MapPin className="inline size-3" />{" "}
                        {[r.city, r.state, r.country].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {" · "}
                    {formatDateTime(r.createdAt)}
                  </p>
                  {/* Contact actions */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <a
                      href={`mailto:${r.email}?subject=${encodeURIComponent("Re: Your Nutriyet business inquiry")}`}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                    >
                      <Mail className="size-3.5" /> Reply
                    </a>
                    <a
                      href={`tel:${r.phone}`}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                    >
                      <Phone className="size-3.5" /> Call
                    </a>
                    <button
                      type="button"
                      onClick={() => copy(r.email, "Email")}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                    >
                      <Copy className="size-3.5" /> {r.email}
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(r.phone, "Phone")}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                    >
                      <Copy className="size-3.5" /> {r.phone}
                    </button>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <select
                    className={cn(
                      "h-8 rounded-md border bg-transparent px-2 text-xs font-medium",
                    )}
                    value={r.status}
                    onChange={(e) => setRowStatus(r.id, e.target.value)}
                  >
                    {B2B_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {B2B_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      B2B_STATUS_CLASS[r.status],
                    )}
                  >
                    {B2B_STATUS_LABELS[r.status]}
                  </span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setView(r)} aria-label="View">
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove(r.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <BulkBar
        count={sel.count}
        actions={BULK_ACTIONS}
        onRun={runBulk}
        onClear={sel.clear}
        pending={bulkPending}
      >
        <select
          className="h-8 rounded-md border bg-transparent px-2 text-sm"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            e.currentTarget.value = "";
            if (v) runBulk(`status:${v}`);
          }}
          aria-label="Set status for selected"
        >
          <option value="" disabled>
            Set status…
          </option>
          {B2B_STATUSES.map((s) => (
            <option key={s} value={s}>
              {B2B_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </BulkBar>

      {/* View dialog */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {view && (
            <>
              <DialogHeader>
                <DialogTitle>Business inquiry</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <span
                  className={cn(
                    "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                    B2B_STATUS_CLASS[view.status],
                  )}
                >
                  {B2B_STATUS_LABELS[view.status]}
                </span>
                <dl className="grid grid-cols-[120px_1fr] gap-y-2">
                  <Detail k="Inquiry ID" v={view.id} mono />
                  <Detail k="Date" v={formatDateTime(view.createdAt)} />
                  <Detail k="Name" v={view.fullName} />
                  <Detail k="Company" v={view.companyName || "—"} />
                  <Detail k="Business type" v={view.businessType} />
                  <Detail k="Mobile" v={view.phone} />
                  <Detail k="Email" v={view.email} />
                  <Detail k="City" v={view.city || "—"} />
                  <Detail k="State" v={view.state || "—"} />
                  <Detail k="Country" v={view.country || "—"} />
                  <Detail k="Purpose" v={view.purpose} />
                </dl>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Message</p>
                  <p className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-3">{view.message}</p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm" className="gap-1.5">
                    <a href={`mailto:${view.email}?subject=${encodeURIComponent("Re: Your Nutriyet business inquiry")}`}>
                      <Mail className="size-4" /> Reply by email
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <a href={`tel:${view.phone}`}>
                      <Phone className="size-4" /> Call
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(view.email, "Email")}>
                    <Copy className="size-4" /> Copy email
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(view.phone, "Phone")}>
                    <Copy className="size-4" /> Copy phone
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn("font-medium", mono && "break-all font-mono text-xs")}>{v}</dd>
    </>
  );
}
