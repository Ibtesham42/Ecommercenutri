"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, RotateCcw, Download } from "lucide-react";
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
import { bulkAffiliateAction } from "@/lib/actions/admin/affiliates";
import { formatDate } from "@/lib/format";
import { AFFILIATE_ROLE_LABEL, AFFILIATE_STATUS_LABEL } from "@/lib/affiliate/labels";
import type { AffiliateRole, AffiliateStatus } from "@prisma/client";

export type AffiliateRow = {
  id: string;
  displayName: string;
  code: string;
  email: string;
  role: AffiliateRole;
  clicks: number;
  orders: number;
  status: AffiliateStatus;
  createdAt: string;
};

const STATUS_VARIANT: Record<string, "secondary" | "default" | "destructive"> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  SUSPENDED: "destructive",
};

const ACTIONS: BulkAction[] = [
  {
    key: "suspend",
    label: "Suspend",
    icon: Ban,
    destructive: true,
    confirm: {
      title: "Suspend selected affiliates?",
      description:
        "Their referral coupon is deactivated and new referrals stop being attributed. You can reactivate them later.",
      actionLabel: "Suspend",
    },
  },
  { key: "reactivate", label: "Reactivate", icon: RotateCcw },
  { key: "export", label: "Export CSV", icon: Download },
];
const VERB: Record<string, string> = { suspend: "suspended", reactivate: "reactivated" };

export function AffiliateTable({ affiliates }: { affiliates: AffiliateRow[] }) {
  const router = useRouter();
  const sel = useBulkSelection(affiliates.map((a) => a.id));
  const [pending, startTransition] = useTransition();

  function run(key: string) {
    if (key === "export") {
      const rows = affiliates.filter((a) => sel.isSelected(a.id));
      downloadCsv(
        "affiliates",
        ["Name", "Code", "Email", "Role", "Clicks", "Orders", "Status", "Joined"],
        rows.map((a) => [
          a.displayName,
          a.code,
          a.email,
          AFFILIATE_ROLE_LABEL[a.role],
          String(a.clicks),
          String(a.orders),
          AFFILIATE_STATUS_LABEL[a.status],
          formatDate(a.createdAt),
        ]),
      );
      return;
    }
    startTransition(async () => {
      const res = await bulkAffiliateAction(sel.selectedIds, key as "suspend" | "reactivate");
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
            <TableHead>Affiliate</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Clicks</TableHead>
            <TableHead>Orders</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {affiliates.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                No affiliates found.
              </TableCell>
            </TableRow>
          ) : (
            affiliates.map((a) => (
              <TableRow key={a.id} data-state={sel.isSelected(a.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${a.displayName}`}
                    checked={sel.isSelected(a.id)}
                    onCheckedChange={() => sel.toggle(a.id)}
                  />
                </TableCell>
                <TableCell>
                  <Link href={`/admin/affiliates/${a.id}`} className="font-medium hover:text-primary">
                    {a.displayName}
                  </Link>
                  <p className="font-mono text-xs text-muted-foreground">{a.code}</p>
                </TableCell>
                <TableCell className="max-w-[180px] truncate text-muted-foreground">{a.email}</TableCell>
                <TableCell className="text-muted-foreground">{AFFILIATE_ROLE_LABEL[a.role]}</TableCell>
                <TableCell>{a.clicks}</TableCell>
                <TableCell>{a.orders}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[a.status] ?? "secondary"}>
                    {AFFILIATE_STATUS_LABEL[a.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(a.createdAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <BulkBar count={sel.count} actions={ACTIONS} onRun={run} onClear={sel.clear} pending={pending} />
    </div>
  );
}
