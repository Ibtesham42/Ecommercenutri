"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X, IndianRupee } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { bulkReturnAction } from "@/lib/actions/admin/returns";
import { formatPrice, formatDate } from "@/lib/format";
import { returnBadgeVariant, returnStatusLabel } from "@/lib/return-status";
import type { ReturnStatus } from "@prisma/client";

export type ReturnRow = {
  id: string;
  returnNumber: string;
  orderNumber: string;
  customer: string;
  createdAt: string;
  paymentMethod: string;
  status: ReturnStatus;
  refund: number;
  items: number;
};

const ACTIONS: BulkAction[] = [
  { key: "approve", label: "Approve", icon: Check },
  {
    key: "reject",
    label: "Reject",
    icon: X,
    destructive: true,
    confirm: {
      title: "Reject selected returns?",
      description: "The customer is notified. Closed returns in the selection are skipped.",
      actionLabel: "Reject",
    },
  },
  {
    key: "refund",
    label: "Mark refunded",
    icon: IndianRupee,
    confirm: {
      title: "Refund selected returns?",
      description:
        "Refunds the full returnable amount to the original payment method. COD / manual-only returns are skipped — refund those from the detail page.",
      actionLabel: "Refund",
    },
  },
];
const VERB: Record<string, string> = { approve: "approved", reject: "rejected", refund: "refunded" };

export function ReturnTable({ returns }: { returns: ReturnRow[] }) {
  const router = useRouter();
  const sel = useBulkSelection(returns.map((r) => r.id));
  const [pending, startTransition] = useTransition();

  function run(key: string) {
    startTransition(async () => {
      const res = await bulkReturnAction(sel.selectedIds, key as "approve" | "reject" | "refund");
      if (toastBulk(res, VERB[key] ?? "updated")) {
        sel.clear();
        router.refresh();
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
            <TableHead>Return</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Refund</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {returns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                No return requests found.
              </TableCell>
            </TableRow>
          ) : (
            returns.map((r) => (
              <TableRow key={r.id} data-state={sel.isSelected(r.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${r.returnNumber}`}
                    checked={sel.isSelected(r.id)}
                    onCheckedChange={() => sel.toggle(r.id)}
                  />
                </TableCell>
                <TableCell>
                  <Link href={`/admin/returns/${r.returnNumber}`} className="font-medium hover:text-primary">
                    {r.returnNumber}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {r.items} item{r.items === 1 ? "" : "s"}
                  </p>
                </TableCell>
                <TableCell className="text-muted-foreground">#{r.orderNumber}</TableCell>
                <TableCell className="max-w-[180px] truncate">{r.customer}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant={r.paymentMethod === "COD" ? "secondary" : "outline"}>
                    {r.paymentMethod === "COD" ? "COD" : "Prepaid"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={returnBadgeVariant[r.status]}>{returnStatusLabel(r.status)}</Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">{formatPrice(r.refund)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <BulkBar count={sel.count} actions={ACTIONS} onRun={run} onClear={sel.clear} pending={pending} />
    </div>
  );
}
