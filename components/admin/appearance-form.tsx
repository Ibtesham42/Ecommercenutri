"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Control } from "react-hook-form";
import { Loader2, Palette, Megaphone, Phone, Share2, Search, Image as ImageIcon, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { updateStoreSettings } from "@/lib/actions/admin/settings";
import { rupeesToPaise } from "@/lib/format";

export type AppearanceValues = {
  siteName: string;
  tagline: string;
  logo: string;
  logoDark: string;
  favicon: string;
  logoHeight: number | null;
  logoHeightMobile: number | null;
  logoMaxWidth: number | null;
  primaryColor: string;
  secondaryColor: string;
  announcement: string;
  announcementActive: boolean;
  announcementLink: string;
  // Pricing & tax — GST is a percent; fees/threshold are entered in ₹.
  defaultGstRate: number | null;
  defaultShippingFee: number | null; // rupees
  freeShippingThreshold: number | null; // rupees
  gstin: string;
  supportEmail: string;
  supportPhone: string;
  whatsapp: string;
  address: string;
  businessHours: string;
  mapsEmbedUrl: string;
  instagram: string;
  facebook: string;
  twitter: string;
  youtube: string;
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
};

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-background p-5">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <Icon className="size-4 text-primary" /> {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function ColorField({
  control,
  name,
  label,
  fallback,
}: {
  control: Control<AppearanceValues>;
  name: "primaryColor" | "secondaryColor";
  label: string;
  fallback: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="space-y-1.5">
          <Label>{label}</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={`${label} picker`}
              value={field.value || fallback}
              onChange={(e) => field.onChange(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1"
            />
            <Input
              placeholder={`${fallback} (blank = default)`}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              className="font-mono"
            />
            {field.value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange("")}>
                Reset
              </Button>
            )}
          </div>
        </div>
      )}
    />
  );
}

function NumberField({
  control,
  name,
  label,
  placeholder,
  hint,
}: {
  control: Control<AppearanceValues>;
  name: "logoHeight" | "logoHeightMobile" | "logoMaxWidth";
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
          <Label>{label}</Label>
          <Input
            type="number"
            inputMode="numeric"
            placeholder={placeholder}
            value={field.value ?? ""}
            onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
          />
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      )}
    />
  );
}

export function AppearanceForm({
  initial,
  cloudinaryReady,
}: {
  initial: AppearanceValues;
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, control } = useForm<AppearanceValues>({
    defaultValues: initial,
  });

  async function onSubmit(v: AppearanceValues) {
    setSaving(true);
    const payload = {
      ...v,
      // Money is stored as paise; the form collects rupees.
      defaultShippingFee:
        v.defaultShippingFee != null ? rupeesToPaise(v.defaultShippingFee) : undefined,
      freeShippingThreshold:
        v.freeShippingThreshold != null ? rupeesToPaise(v.freeShippingThreshold) : undefined,
      defaultGstRate: v.defaultGstRate ?? undefined,
    };
    const res = await updateStoreSettings(payload);
    setSaving(false);
    if (res.ok) {
      toast.success("Appearance saved");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const imageField = (
    name: keyof AppearanceValues,
    label: string,
    folder = "branding",
    accept?: string,
  ) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <ImageUploadField
            value={field.value as string}
            onChange={field.onChange}
            cloudinaryReady={cloudinaryReady}
            folder={folder}
            {...(accept ? { accept } : {})}
          />
        )}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Section title="Branding" icon={ImageIcon}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="siteName">Website name</Label>
            <Input id="siteName" placeholder="Nutriyet" {...register("siteName")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tagline">Tagline</Label>
            <Input id="tagline" placeholder="Eat clean. Live strong." {...register("tagline")} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {imageField("logo", "Logo")}
          {imageField("logoDark", "Dark logo (optional)")}
          {imageField("favicon", "Favicon", "branding", "image/png,image/svg+xml,image/x-icon,.png,.svg,.ico")}
        </div>
        <p className="text-xs text-muted-foreground">
          This logo appears across the whole site — storefront header &amp; footer and the
          login, sign-up, password and account pages. Blank uses the default wordmark.
        </p>
        <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-medium">Logo size</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField control={control} name="logoHeight" label="Desktop height (px)" placeholder="32" hint="16–64" />
            <NumberField control={control} name="logoHeightMobile" label="Mobile height (px)" placeholder="32" hint="16–64" />
            <NumberField control={control} name="logoMaxWidth" label="Max width (px)" placeholder="160" hint="60–400" />
          </div>
          <p className="text-xs text-muted-foreground">
            Controls the uploaded logo across the header and footer. Leave blank for defaults
            (32px tall, 160px wide).
          </p>
        </div>
      </Section>

      <Section title="Theme colors" icon={Palette}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField control={control} name="primaryColor" label="Primary color" fallback="#16803c" />
          <ColorField control={control} name="secondaryColor" label="Secondary color" fallback="#e7f6ec" />
        </div>
        <p className="text-xs text-muted-foreground">
          Leave blank to use the default brand palette. Applies across the storefront.
        </p>
      </Section>

      <Section title="Announcement bar" icon={Megaphone}>
        <Controller
          control={control}
          name="announcementActive"
          render={({ field }) => (
            <label className="flex items-center justify-between text-sm">
              Show the announcement bar at the top of the storefront
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </label>
          )}
        />
        <div className="space-y-1.5">
          <Label htmlFor="announcement">Message</Label>
          <Input id="announcement" placeholder="Free shipping on orders over ₹499" {...register("announcement")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="announcementLink">Link (optional)</Label>
          <Input id="announcementLink" placeholder="https://… or /products" {...register("announcementLink")} />
        </div>
      </Section>

      <Section title="Pricing &amp; tax" icon={Receipt}>
        <p className="text-sm text-muted-foreground">
          Store-wide defaults. Individual products can override the GST rate and
          delivery charge. Prices are inclusive of GST.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Controller
            control={control}
            name="defaultGstRate"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label htmlFor="defaultGstRate">Default GST (%)</Label>
                <Input
                  id="defaultGstRate"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min={0}
                  max={100}
                  placeholder="0"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : Number(e.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground">e.g. 0, 5, 12, 18, 28</p>
              </div>
            )}
          />
          <Controller
            control={control}
            name="defaultShippingFee"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label htmlFor="defaultShippingFee">Default delivery (₹)</Label>
                <Input
                  id="defaultShippingFee"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  placeholder="49"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : Number(e.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground">Below the free threshold</p>
              </div>
            )}
          />
          <Controller
            control={control}
            name="freeShippingThreshold"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label htmlFor="freeShippingThreshold">Free shipping over (₹)</Label>
                <Input
                  id="freeShippingThreshold"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  placeholder="499"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : Number(e.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground">Set 0 to disable</p>
              </div>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gstin">GSTIN (optional)</Label>
          <Input id="gstin" placeholder="22AAAAA0000A1Z5" {...register("gstin")} />
          <p className="text-xs text-muted-foreground">
            Shown on the tax invoice when set.
          </p>
        </div>
      </Section>

      <Section title="Contact" icon={Phone}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="supportEmail">Support email</Label>
            <Input id="supportEmail" type="email" {...register("supportEmail")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supportPhone">Support phone</Label>
            <Input id="supportPhone" {...register("supportPhone")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp">WhatsApp number</Label>
            <Input id="whatsapp" placeholder="919000000000" {...register("whatsapp")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="businessHours">Business hours</Label>
            <Input id="businessHours" placeholder="Mon–Sat, 9am–7pm" {...register("businessHours")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...register("address")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mapsEmbedUrl">Google Maps embed URL</Label>
            <Input id="mapsEmbedUrl" placeholder="https://www.google.com/maps/embed?…" {...register("mapsEmbedUrl")} />
          </div>
        </div>
      </Section>

      <Section title="Social links" icon={Share2}>
        <div className="grid gap-4 sm:grid-cols-2">
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
      </Section>

      <Section title="SEO defaults" icon={Search}>
        <div className="space-y-1.5">
          <Label htmlFor="metaTitle">Default meta title</Label>
          <Input id="metaTitle" {...register("metaTitle")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="metaDescription">Default meta description</Label>
          <Textarea id="metaDescription" rows={2} {...register("metaDescription")} />
        </div>
        {imageField("ogImage", "Default social share image (OG)", "seo")}
      </Section>

      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" disabled={saving} size="lg" className="gap-2 shadow-lg">
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save appearance
        </Button>
      </div>
    </form>
  );
}
