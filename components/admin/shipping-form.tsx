"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Control } from "react-hook-form";
import { Loader2, Truck, Banknote, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateShippingSettings } from "@/lib/actions/admin/settings";
import { rupeesToPaise } from "@/lib/format";

export type ShippingValues = {
  freeShippingEnabled: boolean;
  defaultShippingFee: number | null; // rupees
  freeShippingThreshold: number | null; // rupees
  localDeliveryFee: number | null; // rupees
  expressDeliveryFee: number | null; // rupees
  codFee: number | null; // rupees
  codEnabled: boolean;
  codMinOrder: number | null; // rupees
  codMaxOrder: number | null; // rupees
  returnsEnabled: boolean;
  returnWindowDays: number | null; // days
};

type MoneyName = Exclude<
  keyof ShippingValues,
  "freeShippingEnabled" | "codEnabled" | "returnsEnabled" | "returnWindowDays"
>;

function MoneyField({
  control,
  name,
  label,
  placeholder,
  hint,
}: {
  control: Control<ShippingValues>;
  name: MoneyName;
  label: string;
  placeholder: string;
  hint?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="space-y-1.5">
          <Label htmlFor={name}>{label}</Label>
          <Input
            id={name}
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            placeholder={placeholder}
            value={field.value ?? ""}
            onChange={(e) =>
              field.onChange(e.target.value === "" ? null : Number(e.target.value))
            }
          />
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      )}
    />
  );
}

export function ShippingForm({ initial }: { initial: ShippingValues }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const { handleSubmit, control } = useForm<ShippingValues>({ defaultValues: initial });

  const toPaise = (v: number | null) => (v != null ? rupeesToPaise(v) : undefined);

  async function onSubmit(v: ShippingValues) {
    setSaving(true);
    const res = await updateShippingSettings({
      freeShippingEnabled: v.freeShippingEnabled,
      defaultShippingFee: toPaise(v.defaultShippingFee),
      freeShippingThreshold: toPaise(v.freeShippingThreshold),
      localDeliveryFee: toPaise(v.localDeliveryFee),
      expressDeliveryFee: toPaise(v.expressDeliveryFee),
      codFee: toPaise(v.codFee),
      codEnabled: v.codEnabled,
      codMinOrder: toPaise(v.codMinOrder),
      codMaxOrder: toPaise(v.codMaxOrder),
      returnsEnabled: v.returnsEnabled,
      returnWindowDays: v.returnWindowDays ?? 7,
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Shipping settings saved");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <section className="rounded-xl border bg-background p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <Truck className="size-4 text-primary" /> Delivery charges
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          The order delivery charge uses a product&rsquo;s own delivery charge when set,
          otherwise the default below. With multiple products, the highest applicable
          charge applies (charges are never summed). All amounts in ₹.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField
            control={control}
            name="defaultShippingFee"
            label="Default / standard delivery (₹)"
            placeholder="49"
            hint="Used when a product has no delivery charge of its own"
          />
          <MoneyField
            control={control}
            name="localDeliveryFee"
            label="Local delivery (₹)"
            placeholder="Optional"
            hint="Optional delivery option"
          />
          <MoneyField
            control={control}
            name="expressDeliveryFee"
            label="Express delivery (₹)"
            placeholder="Optional"
            hint="Optional delivery option"
          />
        </div>
      </section>

      <section className="rounded-xl border bg-background p-5">
        <h2 className="mb-4 font-semibold">Free delivery</h2>
        <Controller
          control={control}
          name="freeShippingEnabled"
          render={({ field }) => (
            <label className="flex items-center justify-between text-sm">
              Offer free delivery above a threshold
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </label>
          )}
        />
        <div className="mt-4 max-w-xs">
          <MoneyField
            control={control}
            name="freeShippingThreshold"
            label="Free delivery over (₹)"
            placeholder="499"
            hint="Orders at or above this subtotal ship free"
          />
        </div>
      </section>

      <section className="rounded-xl border bg-background p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <Banknote className="size-4 text-primary" /> Cash on Delivery
        </h2>
        <Controller
          control={control}
          name="codEnabled"
          render={({ field }) => (
            <label className="flex items-center justify-between text-sm">
              Offer Cash on Delivery at checkout
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </label>
          )}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <MoneyField
            control={control}
            name="codFee"
            label="COD handling fee (₹)"
            placeholder="Optional"
            hint="Added to the order total for COD"
          />
          <MoneyField
            control={control}
            name="codMinOrder"
            label="Min order for COD (₹)"
            placeholder="Optional"
            hint="Below this, COD is hidden"
          />
          <MoneyField
            control={control}
            name="codMaxOrder"
            label="Max order for COD (₹)"
            placeholder="Optional"
            hint="Above this, COD is hidden"
          />
        </div>
      </section>

      <section className="rounded-xl border bg-background p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <RotateCcw className="size-4 text-primary" /> Returns &amp; refunds
        </h2>
        <Controller
          control={control}
          name="returnsEnabled"
          render={({ field }) => (
            <label className="flex items-center justify-between text-sm">
              Allow customers to request returns on delivered orders
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </label>
          )}
        />
        <div className="mt-4 max-w-xs">
          <Controller
            control={control}
            name="returnWindowDays"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label htmlFor="returnWindowDays">Return window (days)</Label>
                <Input
                  id="returnWindowDays"
                  type="number"
                  min={0}
                  max={365}
                  step={1}
                  placeholder="7"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : Number(e.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Days after delivery a return can be requested. Products can override this.
                </p>
              </div>
            )}
          />
        </div>
      </section>

      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" disabled={saving} size="lg" className="gap-2 shadow-lg">
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save shipping
        </Button>
      </div>
    </form>
  );
}
