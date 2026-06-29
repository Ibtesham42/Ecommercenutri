"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Eye, EyeOff, Download } from "lucide-react";
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
import { downloadCsv } from "@/lib/admin/csv-export";
import { bulkCustomerAction } from "@/lib/actions/admin/customers";
import { formatPrice, formatDate } from "@/lib/format";

export type CustomerRow = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  orders: number;
  spend: number;
  isActive: boolean;
};

const ACTIONS: BulkAction[] = [
  { key: "activate", label: "Activate", icon: Eye },
  { key: "deactivate", label: "Deactivate", icon: EyeOff },
  { key: "export", label: "Export CSV", icon: Download },
  {
    key: "delete",
    label: "Delete",
    icon: Trash2,
    destructive: true,
    confirm: {
      title: "Delete selected customers?",
      description:
        "Customers with no orders are permanently deleted; those with order history are kept (deactivate them instead). This cannot be undone.",
      actionLabel: "Delete",
    },
  },
];
const VERB: Record<string, string> = {
  activate: "activated",
  deactivate: "deactivated",
  delete: "deleted",
};

export function CustomerTable({ customers }: { customers: CustomerRow[] }) {
  const router = useRouter();
  const sel = useBulkSelection(customers.map((c) => c.id));
  const [pending, startTransition] = useTransition();

  function run(key: string) {
    if (key === "export") {
      const rows = customers.filter((c) => sel.isSelected(c.id));
      downloadCsv(
        "customers",
        ["Name", "Email", "Joined", "Orders", "Total spend (₹)", "Status"],
        rows.map((c) => [
          c.name ?? "",
          c.email,
          formatDate(c.createdAt),
          String(c.orders),
          (c.spend / 100).toFixed(2),
          c.isActive ? "Active" : "Disabled",
        ]),
      );
      return;
    }
    startTransition(async () => {
      const res = await bulkCustomerAction(
        sel.selectedIds,
        key as "activate" | "deactivate" | "delete",
      );
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
            <TableHead>Customer</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Orders</TableHead>
            <TableHead className="text-right">Total spend</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                No customers found.
              </TableCell>
            </TableRow>
          ) : (
            customers.map((u) => (
              <TableRow key={u.id} data-state={sel.isSelected(u.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${u.name ?? u.email}`}
                    checked={sel.isSelected(u.id)}
                    onCheckedChange={() => sel.toggle(u.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/customers/${u.id}`} className="font-medium hover:text-primary">
                      {u.name ?? "—"}
                    </Link>
                    {!u.isActive && (
                      <Badge variant="secondary" className="text-destructive">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{u.orders}</Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">{formatPrice(u.spend)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <BulkBar count={sel.count} actions={ACTIONS} onRun={run} onClear={sel.clear} pending={pending} />
    </div>
  );
}
