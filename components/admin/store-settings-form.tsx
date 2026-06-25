"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateStoreSettings } from "@/lib/actions/admin/settings";

export type StoreSettingsValues = {
  supportEmail: string;
  supportPhone: string;
  address: string;
  announcement: string;
  instagram: string;
  facebook: string;
  twitter: string;
  youtube: string;
};

export function StoreSettingsForm({ initial }: { initial: StoreSettingsValues }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit } = useForm<StoreSettingsValues>({
    defaultValues: initial,
  });

  async function onSubmit(v: StoreSettingsValues) {
    setSaving(true);
    const res = await updateStoreSettings(v);
    setSaving(false);
    if (res.ok) {
      toast.success("Store settings saved");
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="supportEmail">Support email</Label>
          <Input id="supportEmail" type="email" {...register("supportEmail")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="supportPhone">Support phone</Label>
          <Input id="supportPhone" {...register("supportPhone")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="storeAddress">Store address</Label>
          <Input id="storeAddress" {...register("address")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="announcement">Announcement banner (optional)</Label>
          <Input id="announcement" placeholder="e.g. Free shipping over ₹499" {...register("announcement")} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="instagram">Instagram URL</Label>
          <Input id="instagram" {...register("instagram")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="facebook">Facebook URL</Label>
          <Input id="facebook" {...register("facebook")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="twitter">Twitter/X URL</Label>
          <Input id="twitter" {...register("twitter")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="youtube">YouTube URL</Label>
          <Input id="youtube" {...register("youtube")} />
        </div>
      </div>

      <Button type="submit" disabled={saving} className="gap-2">
        {saving && <Loader2 className="size-4 animate-spin" />}
        Save store settings
      </Button>
    </form>
  );
}
