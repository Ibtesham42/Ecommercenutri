"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star, Eye, EyeOff, Trash2, Download } from "lucide-react";
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
import { downloadCsv } from "@/lib/admin/csv-export";
import { bulkReviewAction, setReviewApproved, deleteReview } from "@/lib/actions/admin/reviews";
import { formatDate } from "@/lib/format";

export type ReviewRow = {
  id: string;
  productName: string;
  productSlug: string;
  customer: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isApproved: boolean;
  createdAt: string;
};

const ACTIONS: BulkAction[] = [
  { key: "approve", label: "Approve", icon: Eye },
  { key: "hide", label: "Hide", icon: EyeOff },
  { key: "export", label: "Export CSV", icon: Download },
  {
    key: "delete",
    label: "Delete",
    icon: Trash2,
    destructive: true,
    confirm: {
      title: "Delete selected reviews?",
      description: "This permanently removes the selected reviews and updates product ratings. This cannot be undone.",
      actionLabel: "Delete",
    },
  },
];
const VERB: Record<string, string> = { approve: "approved", hide: "hidden", delete: "deleted" };

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={i < n ? "size-3.5 fill-gold text-gold" : "size-3.5 text-muted-foreground/40"}
        />
      ))}
    </span>
  );
}

export function ReviewTable({ reviews }: { reviews: ReviewRow[] }) {
  const router = useRouter();
  const sel = useBulkSelection(reviews.map((r) => r.id));
  const [pending, startTransition] = useTransition();

  function run(key: string) {
    if (key === "export") {
      const rows = reviews.filter((r) => sel.isSelected(r.id));
      downloadCsv(
        "reviews",
        ["Product", "Customer", "Rating", "Title", "Comment", "Status", "Date"],
        rows.map((r) => [
          r.productName,
          r.customer,
          String(r.rating),
          r.title ?? "",
          r.comment ?? "",
          r.isApproved ? "Approved" : "Hidden",
          formatDate(r.createdAt),
        ]),
      );
      return;
    }
    startTransition(async () => {
      const res = await bulkReviewAction(sel.selectedIds, key as "approve" | "hide" | "delete");
      if (toastBulk(res, VERB[key] ?? "updated")) {
        sel.clear();
        router.refresh();
      }
    });
  }

  function toggle(id: string, approved: boolean) {
    startTransition(async () => {
      const res = await setReviewApproved(id, approved);
      if (res.ok) {
        toast.success(approved ? "Review approved" : "Review hidden");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this review?")) return;
    startTransition(async () => {
      const res = await deleteReview(id);
      if (res.ok) {
        toast.success("Review deleted");
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
            <TableHead>Product</TableHead>
            <TableHead>Review</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                No reviews found.
              </TableCell>
            </TableRow>
          ) : (
            reviews.map((r) => (
              <TableRow key={r.id} data-state={sel.isSelected(r.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    aria-label={`Select review by ${r.customer}`}
                    checked={sel.isSelected(r.id)}
                    onCheckedChange={() => sel.toggle(r.id)}
                  />
                </TableCell>
                <TableCell className="max-w-[160px]">
                  <Link href={`/products/${r.productSlug}`} target="_blank" className="font-medium hover:text-primary">
                    {r.productName}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[280px]">
                  <Stars n={r.rating} />
                  {r.title && <p className="truncate text-sm font-medium">{r.title}</p>}
                  {r.comment && <p className="line-clamp-2 text-xs text-muted-foreground">{r.comment}</p>}
                </TableCell>
                <TableCell className="max-w-[140px] truncate text-muted-foreground">{r.customer}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant={r.isApproved ? "default" : "secondary"}>
                    {r.isApproved ? "Approved" : "Hidden"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggle(r.id, !r.isApproved)}
                      disabled={pending}
                      aria-label={r.isApproved ? "Hide" : "Approve"}
                    >
                      {r.isApproved ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove(r.id)}
                      disabled={pending}
                      aria-label="Delete"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
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
