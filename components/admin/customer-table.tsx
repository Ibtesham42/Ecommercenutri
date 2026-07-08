"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Ban, CheckCircle, Download, BadgeCheck, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  type CustomerSegment,
  type RegistrationSource,
  SEGMENT_LABEL,
  SEGMENT_BADGE_CLASS,
  SOURCE_LABEL,
  initials,
} from "@/lib/customers/segment";
import { cn } from "@/lib/utils";

export type CustomerRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  phone: string | null;
  createdAt: string;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  orders: number;
  spend: number;
  aov: number;
  segment: CustomerSegment;
  source: RegistrationSource;
  affiliateStatus: string | null;
  city: string | null;
  state: string | null;
};

const ACTIONS: BulkAction[] = [
  { key: "export", label: "Export CSV", icon: Download },
  { key: "activate", label: "Activate", icon: CheckCircle },
  { key: "deactivate", label: "Block", icon: Ban },
  {
    key: "delete",
    label: "Delete",
    icon: Trash2,
    destructive: true,
    confirm: {
      title: "Delete selected customers?",
      description:
        "Customers with no orders are permanently deleted; those with order history are kept (block them instead). This cannot be undone.",
      actionLabel: "Delete",
    },
  },
];
const VERB: Record<string, string> = {
  activate: "activated",
  deactivate: "blocked",
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
        ["Name", "Email", "Phone", "City", "State", "Segment", "Joined", "Orders", "Total spend (₹)", "AOV (₹)", "Source", "Status"],
        rows.map((c) => [
          c.name ?? "",
          c.email,
          c.phone ?? "",
          c.city ?? "",
          c.state ?? "",
          SEGMENT_LABEL[c.segment],
          formatDate(c.createdAt),
          String(c.orders),
          (c.spend / 100).toFixed(2),
          (c.aov / 100).toFixed(2),
          SOURCE_LABEL[c.source],
          c.isActive ? "Active" : "Blocked",
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
            <TableHead>Contact</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Segment</TableHead>
            <TableHead className="text-center">Orders</TableHead>
            <TableHead className="text-right">Spend</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="whitespace-nowrap">Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                No customers found.
              </TableCell>
            </TableRow>
          ) : (
            customers.map((u) => (
              <TableRow
                key={u.id}
                data-state={sel.isSelected(u.id) ? "selected" : undefined}
                className="transition-colors hover:bg-muted/40"
              >
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${u.name ?? u.email}`}
                    checked={sel.isSelected(u.id)}
                    onCheckedChange={() => sel.toggle(u.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar>
                      {u.image && <AvatarImage src={u.image} alt="" />}
                      <AvatarFallback className="text-xs font-medium">
                        {initials(u.name, u.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/admin/customers/${u.id}`}
                          className="truncate font-medium hover:text-primary"
                        >
                          {u.name ?? "Unnamed"}
                        </Link>
                        {u.affiliateStatus && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px] uppercase">
                            Affiliate
                          </Badge>
                        )}
                      </div>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <span className="truncate">{u.email}</span>
                        {u.emailVerified && (
                          <BadgeCheck className="size-3 shrink-0 text-primary" aria-label="Email verified" />
                        )}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {u.phone ? (
                    <span className="flex items-center gap-1 whitespace-nowrap text-sm">
                      <Phone className="size-3 text-muted-foreground" />
                      {u.phone}
                      {u.phoneVerified && (
                        <BadgeCheck className="size-3 text-primary" aria-label="Phone verified" />
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {u.city ? (
                    <>
                      {u.city}
                      {u.state ? <span className="block text-[11px]">{u.state}</span> : null}
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      SEGMENT_BADGE_CLASS[u.segment],
                    )}
                  >
                    {SEGMENT_LABEL[u.segment]}
                  </span>
                </TableCell>
                <TableCell className="text-center tabular-nums">{u.orders}</TableCell>
                <TableCell className="text-right">
                  <span className="font-semibold tabular-nums">{formatPrice(u.spend)}</span>
                  {u.orders > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {formatPrice(u.aov)} avg
                    </p>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {SOURCE_LABEL[u.source]}
                </TableCell>
                <TableCell>
                  {u.isActive ? (
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Blocked</Badge>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDate(u.createdAt)}
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
