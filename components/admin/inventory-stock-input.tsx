"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateVariantStock } from "@/lib/actions/admin/products";

export function InventoryStockInput({
  variantId,
  stock,
}: {
  variantId: string;
  stock: number;
}) {
  const [value, setValue] = useState(String(stock));
  const [saved, setSaved] = useState(stock);
  const [pending, startTransition] = useTransition();

  const dirty = Number(value) !== saved && value !== "";

  function save() {
    const next = Number(value);
    if (!Number.isInteger(next) || next < 0) {
      toast.error("Enter a whole number ≥ 0");
      setValue(String(saved));
      return;
    }
    startTransition(async () => {
      const res = await updateVariantStock(variantId, next);
      if (res.ok) {
        setSaved(next);
        toast.success("Stock updated");
      } else {
        toast.error(res.error);
        setValue(String(saved));
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && dirty && save()}
        className="h-8 w-24"
      />
      {dirty && (
        <Button size="icon" variant="outline" className="size-8" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        </Button>
      )}
    </div>
  );
}
