"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, Download, Truck, Trash2, MoreHorizontal, Eye } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BulkBar, type BulkAction } from "@/components/admin/bulk/bulk-bar";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import { toastBulk } from "@/lib/admin/run-bulk";
import { downloadCsv } from "@/lib/admin/csv-export";
import { bulkUpdateOrderStatus, bulkDeleteOrders, deleteOrder } from "@/lib/actions/admin/orders";
import { formatPrice, formatDate } from "@/lib/format";
import {
  ADMIN_STATUS_OPTIONS,
  ORDER_STATUS_LABEL,
  statusBadgeVariant,
  statusLabel,
  isOrderDeletable,
} from "@/lib/order-status";
import type { OrderStatus } from "@prisma/client";

export type OrderRow = {
  id: string;
  orderNumber: string;
  customer: string;
  createdAt: string;
  paymentStatus: string;
  status: string;
  total: number;
  items: number;
};

const ACTIONS: BulkAction[] = [
  { key: "invoices", label: "Invoices", icon: FileText },
  { key: "labels", label: "Labels", icon: Truck },
  { key: "export", label: "Export CSV", icon: Download },
  {
    key: "delete",
    label: "Delete",
    icon: Trash2,
    destructive: true,
    confirm: {
      title: "Delete selected orders?",
      description:
        "This permanently deletes the orders and all their records (items, invoice, timeline, returns). Orders still in progress are skipped automatically. This cannot be undone.",
      actionLabel: "Delete",
    },
  },
];

export function OrderTable({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();
  const sel = useBulkSelection(orders.map((o) => o.id));
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState("");
  const [toDelete, setToDelete] = useState<OrderRow | null>(null);

  function applyStatus() {
    if (!status) return;
    if (status === "CANCELLED" && !confirm(`Cancel ${sel.count} selected order(s)?`)) return;
    startTransition(async () => {
      const res = await bulkUpdateOrderStatus(sel.selectedIds, status);
      if (toastBulk(res, `set to ${ORDER_STATUS_LABEL[status as keyof typeof ORDER_STATUS_LABEL]}`)) {
        sel.clear();
        setStatus("");
        router.refresh();
      }
    });
  }

  function run(key: string) {
    const rows = orders.filter((o) => sel.isSelected(o.id));
    if (key === "delete") {
      startTransition(async () => {
        const res = await bulkDeleteOrders(sel.selectedIds);
        if (toastBulk(res, "deleted")) {
          sel.clear();
          router.refresh();
        }
      });
      return;
    }
    if (key === "invoices") {
      // Sequential same-origin downloads of each selected order's invoice PDF.
      rows.forEach((o, i) => {
        setTimeout(() => {
          const a = document.createElement("a");
          a.href = `/api/invoices/${o.orderNumber}?download=1`;
          a.download = "";
          document.body.appendChild(a);
          a.click();
          a.remove();
        }, i * 350);
      });
      toast.success(`Downloading ${rows.length} invoice(s)…`);
      return;
    }
    if (key === "labels") {
      toast.info("Shipping label generation is coming soon.");
      return;
    }
    if (key === "export") {
      downloadCsv(
        "orders",
        ["Order", "Customer", "Date", "Payment", "Status", "Items", "Total (₹)"],
        rows.map((o) => [
          o.orderNumber,
          o.customer,
          formatDate(o.createdAt),
          o.paymentStatus,
          statusLabel(o.status as OrderStatus),
          String(o.items),
          (o.total / 100).toFixed(2),
        ]),
      );
    }
  }

  function confirmDelete() {
    if (!toDelete) return;
    const order = toDelete;
    startTransition(async () => {
      const res = await deleteOrder(order.id);
      setToDelete(null);
      if (res.ok) {
        toast.success(`Order #${order.orderNumber} deleted`);
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
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                No orders found.
              </TableCell>
            </TableRow>
          ) : (
            orders.map((o) => {
              const deletable = isOrderDeletable(o.status as OrderStatus);
              return (
                <TableRow key={o.id} data-state={sel.isSelected(o.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${o.orderNumber}`}
                      checked={sel.isSelected(o.id)}
                      onCheckedChange={() => sel.toggle(o.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/orders/${o.orderNumber}`} className="font-medium hover:text-primary">
                      #{o.orderNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {o.items} item{o.items === 1 ? "" : "s"}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{o.customer}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant={o.paymentStatus === "PAID" ? "default" : "secondary"}>
                      {o.paymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant[o.status as keyof typeof statusBadgeVariant] ?? "secondary"}>
                      {statusLabel(o.status as OrderStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatPrice(o.total)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Actions" disabled={pending}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/orders/${o.orderNumber}`}>
                            <Eye className="size-4" /> View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {deletable ? (
                          <DropdownMenuItem variant="destructive" onClick={() => setToDelete(o)}>
                            <Trash2 className="size-4" /> Delete
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem disabled className="flex-col items-start gap-0">
                            <span className="flex items-center gap-2">
                              <Trash2 className="size-4" /> Delete
                            </span>
                            <span className="pl-6 text-[11px] text-muted-foreground">
                              Only completed/closed orders
                            </span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <BulkBar count={sel.count} actions={ACTIONS} onRun={run} onClear={sel.clear} pending={pending}>
        <div className="flex items-center gap-1.5">
          <select
            aria-label="Set status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-8 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">Set status…</option>
            {ADMIN_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <Button size="sm" disabled={pending || !status} onClick={applyStatus}>
            Apply
          </Button>
        </div>
      </BulkBar>

      {/* Single-order delete confirmation */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete order #{toDelete?.orderNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This <strong>permanently</strong> deletes the order and all its records — items, invoice,
              timeline and any returns. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
