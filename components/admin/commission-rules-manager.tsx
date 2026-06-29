"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { saveCommissionRule, deleteCommissionRule } from "@/lib/actions/admin/affiliates";
import { AFFILIATE_ROLES } from "@/lib/validations/affiliate";
import { AFFILIATE_ROLE_LABEL } from "@/lib/affiliate/labels";
import { formatPrice } from "@/lib/format";

type Option = { id: string; name: string };
export type RuleRow = {
  id: string;
  scope: string;
  role: string | null;
  type: string;
  value: number;
  isActive: boolean;
  product: { name: string } | null;
  category: { name: string } | null;
};

export function CommissionRulesManager({
  rules,
  products,
  categories,
}: {
  rules: RuleRow[];
  products: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [scope, setScope] = useState("ROLE");
  const [role, setRole] = useState<string>("INFLUENCER");
  const [productId, setProductId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState("PERCENT");
  const [value, setValue] = useState("10");
  const [isActive, setIsActive] = useState(true);

  const field = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

  async function add() {
    setSaving(true);
    const res = await saveCommissionRule({
      scope,
      role: scope === "ROLE" ? role : null,
      productId: scope === "PRODUCT" ? productId : null,
      categoryId: scope === "CATEGORY" ? categoryId : null,
      type,
      value: type === "FIXED" ? Math.round(Number(value) * 100) : Number(value),
      isActive,
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Rule saved");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function remove(id: string) {
    const res = await deleteCommissionRule({ id });
    if (res.ok) {
      toast.success("Rule deleted");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function ruleTarget(r: RuleRow) {
    if (r.scope === "ROLE") return r.role ? AFFILIATE_ROLE_LABEL[r.role as keyof typeof AFFILIATE_ROLE_LABEL] : "—";
    if (r.scope === "PRODUCT") return r.product?.name ?? "Product";
    return r.category?.name ?? "Category";
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Resolved most-specific first: product → category → affiliate override → role → store default.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="size-4" /> Add rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Commission rule</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Scope</Label>
                <select value={scope} onChange={(e) => setScope(e.target.value)} className={field}>
                  <option value="ROLE">Per affiliate role</option>
                  <option value="PRODUCT">Per product</option>
                  <option value="CATEGORY">Per category</option>
                </select>
              </div>
              {scope === "ROLE" && (
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>
                    {AFFILIATE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {AFFILIATE_ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {scope === "PRODUCT" && (
                <div className="space-y-1.5">
                  <Label>Product</Label>
                  <select value={productId} onChange={(e) => setProductId(e.target.value)} className={field}>
                    <option value="">Select…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {scope === "CATEGORY" && (
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field}>
                    <option value="">Select…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className={field}>
                    <option value="PERCENT">Percentage</option>
                    <option value="FIXED">Fixed (₹ per unit)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>{type === "PERCENT" ? "Percent" : "Amount (₹)"}</Label>
                  <Input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
                </div>
              </div>
              <label className="flex items-center justify-between text-sm">
                Active
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </label>
            </div>
            <DialogFooter>
              <Button onClick={add} disabled={saving} className="gap-2">
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No custom rules — the store default applies to everyone.
        </div>
      ) : (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-xl border bg-background p-3 text-sm">
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium">{r.scope}</span>
              <span className="flex-1 font-medium">{ruleTarget(r)}</span>
              <span className="font-semibold">
                {r.type === "PERCENT" ? `${r.value}%` : formatPrice(r.value)}
              </span>
              {!r.isActive && <span className="text-xs text-muted-foreground">(inactive)</span>}
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => remove(r.id)}
                aria-label="Delete"
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
