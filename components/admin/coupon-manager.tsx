"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { Plus, Pencil, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { saveCoupon, deleteCoupon, toggleCoupon, bulkCouponAction } from "@/lib/actions/admin/coupons";
import { formatPrice, rupeesToPaise, paiseToRupees } from "@/lib/format";

const BULK_ACTIONS: BulkAction[] = [
  { key: "activate", label: "Activate", icon: Eye },
  { key: "deactivate", label: "Deactivate", icon: EyeOff },
  {
    key: "delete",
    label: "Delete",
    icon: Trash2,
    destructive: true,
    confirm: {
      title: "Delete selected coupons?",
      description:
        "Coupons already used by an order are deactivated (kept for history); unused ones are permanently deleted.",
      actionLabel: "Delete",
    },
  },
];
const BULK_VERB: Record<string, string> = {
  activate: "activated",
  deactivate: "deactivated",
  delete: "removed",
};

export type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  type: "PERCENT" | "FIXED";
  value: number;
  minOrder: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number | null;
  startsAt: string | null; // ISO
  expiresAt: string | null; // ISO
  isActive: boolean;
};

type FormValues = {
  id?: string;
  code: string;
  description?: string;
  type: "PERCENT" | "FIXED";
  value: number; // percent, or rupees for FIXED
  minOrderRupees?: number | null;
  maxDiscountRupees?: number | null;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  startsAt?: string;
  expiresAt?: string;
  isActive: boolean;
};

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function CouponManager({ coupons }: { coupons: CouponRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [saving, setSaving] = useState(false);
  const sel = useBulkSelection(coupons.map((c) => c.id));
  const [bulkPending, startBulk] = useTransition();

  function runBulk(key: string) {
    startBulk(async () => {
      const res = await bulkCouponAction(
        sel.selectedIds,
        key as "delete" | "activate" | "deactivate",
      );
      if (toastBulk(res, BULK_VERB[key] ?? "updated")) {
        sel.clear();
        router.refresh();
      }
    });
  }

  const { register, handleSubmit, control, reset, watch } = useForm<FormValues>();
  const type = watch("type");

  function openAdd() {
    setEditing(null);
    reset({ code: "", type: "PERCENT", value: 10, isActive: true });
    setOpen(true);
  }
  function openEdit(c: CouponRow) {
    setEditing(c);
    reset({
      id: c.id,
      code: c.code,
      description: c.description ?? "",
      type: c.type,
      value: c.type === "FIXED" ? paiseToRupees(c.value) : c.value,
      minOrderRupees: c.minOrder != null ? paiseToRupees(c.minOrder) : undefined,
      maxDiscountRupees: c.maxDiscount != null ? paiseToRupees(c.maxDiscount) : undefined,
      usageLimit: c.usageLimit ?? undefined,
      perUserLimit: c.perUserLimit ?? undefined,
      startsAt: dateInput(c.startsAt),
      expiresAt: dateInput(c.expiresAt),
      isActive: c.isActive,
    });
    setOpen(true);
  }

  async function onSubmit(v: FormValues) {
    setSaving(true);
    const res = await saveCoupon({
      id: v.id,
      code: v.code.toUpperCase(),
      description: v.description || null,
      type: v.type,
      value: v.type === "FIXED" ? rupeesToPaise(Number(v.value)) : Number(v.value),
      minOrder: v.minOrderRupees ? rupeesToPaise(Number(v.minOrderRupees)) : null,
      maxDiscount: v.maxDiscountRupees ? rupeesToPaise(Number(v.maxDiscountRupees)) : null,
      usageLimit: v.usageLimit ? Number(v.usageLimit) : null,
      perUserLimit: v.perUserLimit ? Number(v.perUserLimit) : null,
      startsAt: v.startsAt || null,
      expiresAt: v.expiresAt || null,
      isActive: v.isActive,
    });
    setSaving(false);
    if (res.ok) {
      toast.success(v.id ? "Coupon updated" : "Coupon created");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function onToggle(c: CouponRow) {
    toggleCoupon(c.id, !c.isActive).then((res) => {
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }
  function onDelete(c: CouponRow) {
    if (!confirm(`Delete coupon "${c.code}"?`)) return;
    deleteCoupon(c.id).then((res) => {
      if (res.ok) {
        toast.success("Coupon removed");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button className="gap-1.5" onClick={openAdd}>
          <Plus className="size-4" /> New coupon
        </Button>
      </div>

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
              <TableHead>Code</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Min order</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  No coupons yet.
                </TableCell>
              </TableRow>
            ) : (
              coupons.map((c) => (
                <TableRow key={c.id} data-state={sel.isSelected(c.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${c.code}`}
                      checked={sel.isSelected(c.id)}
                      onCheckedChange={() => sel.toggle(c.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono font-medium">{c.code}</TableCell>
                  <TableCell>
                    {c.type === "PERCENT" ? `${c.value}%` : formatPrice(c.value)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.minOrder ? formatPrice(c.minOrder) : "—"}
                  </TableCell>
                  <TableCell>
                    {c.usedCount}
                    {c.usageLimit ? ` / ${c.usageLimit}` : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.expiresAt ? dateInput(c.expiresAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <Switch checked={c.isActive} onCheckedChange={() => onToggle(c)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)} aria-label="Edit">
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(c)}
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
      </div>

      <BulkBar
        count={sel.count}
        actions={BULK_ACTIONS}
        onRun={runBulk}
        onClear={sel.clear}
        pending={bulkPending}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit coupon" : "New coupon"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">Code</Label>
                <Input id="code" className="uppercase" {...register("code", { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ctype">Type</Label>
                <select
                  id="ctype"
                  {...register("type")}
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="PERCENT">Percentage</option>
                  <option value="FIXED">Fixed amount</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cdescription">Description</Label>
              <Input id="cdescription" {...register("description")} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="value">{type === "FIXED" ? "Amount (₹)" : "Percent (%)"}</Label>
                <Input id="value" type="number" step="0.01" {...register("value", { valueAsNumber: true, required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minOrder">Min order (₹)</Label>
                <Input id="minOrder" type="number" step="0.01" {...register("minOrderRupees", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxDiscount">Max disc. (₹)</Label>
                <Input id="maxDiscount" type="number" step="0.01" {...register("maxDiscountRupees", { valueAsNumber: true })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="usageLimit">Total usage limit</Label>
                <Input id="usageLimit" type="number" {...register("usageLimit", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="perUserLimit">Per-user limit</Label>
                <Input id="perUserLimit" type="number" {...register("perUserLimit", { valueAsNumber: true })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startsAt">Starts</Label>
                <Input id="startsAt" type="date" {...register("startsAt")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expiresAt">Expires</Label>
                <Input id="expiresAt" type="date" {...register("expiresAt")} />
              </div>
            </div>
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <label className="flex items-center justify-between text-sm">
                  Active
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
