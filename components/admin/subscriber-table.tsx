"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/storefront/empty-state";
import { AtSign } from "lucide-react";
import { downloadCsv } from "@/lib/admin/csv-export";
import { formatDate } from "@/lib/format";

export type SubscriberRow = {
  id: string;
  email: string;
  source: string | null;
  createdAt: string;
  active: boolean;
};

export function SubscriberTable({ subscribers }: { subscribers: SubscriberRow[] }) {
  function exportActive() {
    const active = subscribers.filter((s) => s.active);
    downloadCsv(
      "newsletter-subscribers",
      ["Email", "Source", "Subscribed"],
      active.map((s) => [s.email, s.source ?? "", formatDate(s.createdAt)]),
    );
  }

  if (subscribers.length === 0) {
    return (
      <EmptyState
        icon={AtSign}
        title="No subscribers yet"
        description="Newsletter signups from the footer and blog will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportActive}>
          <Download className="size-4" /> Export active (CSV)
        </Button>
      </div>
      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Subscribed</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscribers.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.email}</TableCell>
                <TableCell className="text-muted-foreground">{s.source ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={s.active ? "default" : "secondary"}>
                    {s.active ? "Active" : "Unsubscribed"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
