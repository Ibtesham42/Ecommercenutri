"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Play, CalendarPlus } from "lucide-react";
import type { SocialProductOption } from "@/lib/queries/social";
import { SOCIAL_PILLAR_VALUES, SOCIAL_DAYPART_VALUES } from "@/lib/validations/social";
import { PILLAR_LABEL, DAYPART_LABEL } from "@/lib/social/strategy";
import type { Pillar, Daypart } from "@/lib/social/strategy";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  generateSocialDraft,
  planSocialNow,
  runSocialCycleNow,
} from "@/lib/actions/admin/social";

export function SocialActionBar({ products }: { products: SocialProductOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [pillar, setPillar] = useState<Pillar>("PRODUCT_KNOWLEDGE");
  const [daypart, setDaypart] = useState<Daypart>("MORNING");
  const [productId, setProductId] = useState<string>("");

  const generate = () =>
    start(async () => {
      const res = await generateSocialDraft({
        pillar,
        daypart,
        productId: productId || null,
        angle: "",
      });
      if (res.ok) {
        toast.success("Draft generated — see the Queue.");
        setOpen(false);
        router.push("/admin/social/queue");
      } else {
        toast.error(res.error ?? "Couldn't generate.");
      }
    });

  const plan = () =>
    start(async () => {
      const res = await planSocialNow();
      if (res.ok) {
        toast.success(`Planned ${res.data?.planned ?? 0} post(s)${res.data?.skipped ? `, ${res.data.skipped} skipped` : ""}.`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't plan.");
      }
    });

  const runCycle = () =>
    start(async () => {
      const res = await runSocialCycleNow();
      if (res.ok) {
        toast.success(`Planned ${res.data?.planned ?? 0}, published ${res.data?.published ?? 0}, failed ${res.data?.failed ?? 0}.`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't run the cycle.");
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" disabled={pending}>
            <Sparkles className="mr-2 size-4" /> Generate a post
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate a post</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Content pillar</Label>
              <Select value={pillar} onValueChange={(v) => setPillar(v as Pillar)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_PILLAR_VALUES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PILLAR_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Time of day</Label>
              <Select value={daypart} onValueChange={(v) => setDaypart(v as Daypart)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_DAYPART_VALUES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {DAYPART_LABEL[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Product (optional)</Label>
              <Select value={productId || "none"} onValueChange={(v) => setProductId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto-pick" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Auto-pick a product</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={generate} disabled={pending}>
              {pending ? "Generating…" : "Generate draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button size="sm" variant="outline" disabled={pending} onClick={plan}>
        <CalendarPlus className="mr-2 size-4" /> Plan today
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={runCycle}>
        <Play className="mr-2 size-4" /> Run cycle now
      </Button>
    </div>
  );
}
