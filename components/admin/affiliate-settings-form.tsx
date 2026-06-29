"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateAffiliateSettings } from "@/lib/actions/admin/affiliates";

type Values = {
  affiliateEnabled: boolean;
  affiliateCookieDays: number;
  affiliateDefaultCommissionType: "PERCENT" | "FIXED";
  defaultValue: number; // percent, or ₹ when FIXED
  minPayoutRupees: number;
};

export function AffiliateSettingsForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, watch, setValue } = useForm<Values>({ defaultValues: initial });
  const type = watch("affiliateDefaultCommissionType");
  const enabled = watch("affiliateEnabled");

  async function onSubmit(v: Values) {
    setSaving(true);
    const res = await updateAffiliateSettings({
      affiliateEnabled: v.affiliateEnabled,
      affiliateCookieDays: Number(v.affiliateCookieDays),
      affiliateDefaultCommissionType: v.affiliateDefaultCommissionType,
      affiliateDefaultCommissionValue:
        v.affiliateDefaultCommissionType === "FIXED"
          ? Math.round(Number(v.defaultValue) * 100)
          : Number(v.defaultValue),
      affiliateMinPayout: Math.round(Number(v.minPayoutRupees) * 100),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Settings saved");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const field = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-5">
      <section className="rounded-xl border bg-background p-5">
        <label className="flex items-center justify-between text-sm">
          <span>
            <span className="font-medium">Affiliate program enabled</span>
            <span className="block text-xs text-muted-foreground">
              When off, applications and referral attribution pause.
            </span>
          </span>
          <Switch checked={enabled} onCheckedChange={(v) => setValue("affiliateEnabled", v)} />
        </label>
      </section>

      <section className="space-y-4 rounded-xl border bg-background p-5">
        <div className="space-y-1.5">
          <Label htmlFor="cookieDays">Attribution window (days)</Label>
          <Input id="cookieDays" type="number" min={1} max={365} {...register("affiliateCookieDays", { valueAsNumber: true })} />
          <p className="text-xs text-muted-foreground">How long a referral cookie credits the affiliate.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ctype">Default commission type</Label>
            <select id="ctype" {...register("affiliateDefaultCommissionType")} className={field}>
              <option value="PERCENT">Percentage</option>
              <option value="FIXED">Fixed (₹ per unit)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cval">{type === "PERCENT" ? "Default percent" : "Default amount (₹)"}</Label>
            <Input id="cval" type="number" min={0} step="0.01" {...register("defaultValue", { valueAsNumber: true })} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="minPayout">Minimum payout (₹)</Label>
          <Input id="minPayout" type="number" min={0} step="0.01" {...register("minPayoutRupees", { valueAsNumber: true })} />
        </div>
      </section>

      <Button type="submit" disabled={saving} className="gap-2">
        {saving && <Loader2 className="size-4 animate-spin" />}
        Save settings
      </Button>
    </form>
  );
}
