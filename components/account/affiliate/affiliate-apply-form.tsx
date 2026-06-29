"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { applyAffiliate } from "@/lib/actions/affiliate";
import { AFFILIATE_ROLES } from "@/lib/validations/affiliate";
import { AFFILIATE_ROLE_LABEL } from "@/lib/affiliate/labels";
import type { AffiliateRole } from "@prisma/client";

type Values = {
  role: AffiliateRole;
  displayName: string;
  bio: string;
  website: string;
  instagram: string;
  youtube: string;
  audienceSize?: number;
  pitch: string;
  agree: boolean;
};

export function AffiliateApplyForm({ defaultName }: { defaultName?: string | null }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit } = useForm<Values>({
    defaultValues: {
      role: "INFLUENCER",
      displayName: defaultName ?? "",
      bio: "",
      website: "",
      instagram: "",
      youtube: "",
      pitch: "",
      agree: false,
    },
  });

  async function onSubmit(v: Values) {
    setSaving(true);
    const res = await applyAffiliate({
      ...v,
      audienceSize: v.audienceSize ? Number(v.audienceSize) : undefined,
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Application submitted — we'll review it shortly.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const field = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="role">I am a…</Label>
          <select id="role" {...register("role")} className={field}>
            {AFFILIATE_ROLES.map((r) => (
              <option key={r} value={r}>
                {AFFILIATE_ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" {...register("displayName", { required: true })} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bio">Short bio</Label>
        <Textarea id="bio" rows={2} placeholder="Tell us about you and your audience" {...register("bio")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="instagram">Instagram</Label>
          <Input id="instagram" placeholder="@handle or URL" {...register("instagram")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="youtube">YouTube</Label>
          <Input id="youtube" placeholder="Channel URL" {...register("youtube")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="website">Website / blog</Label>
          <Input id="website" placeholder="https://…" {...register("website")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audienceSize">Audience size</Label>
          <Input id="audienceSize" type="number" min={0} placeholder="e.g. 10000" {...register("audienceSize")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pitch">Why do you want to partner with Nutriyet?</Label>
        <Textarea id="pitch" rows={3} {...register("pitch")} />
      </div>

      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input type="checkbox" className="mt-1" {...register("agree", { required: true })} />
        I agree to the affiliate program terms and to share content honestly.
      </label>

      <Button type="submit" disabled={saving} className="gap-2">
        {saving && <Loader2 className="size-4 animate-spin" />}
        Submit application
      </Button>
    </form>
  );
}
