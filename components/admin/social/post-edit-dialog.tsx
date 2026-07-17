"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import type { SocialPostRow } from "@/lib/queries/social";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateSocialPost } from "@/lib/actions/admin/social";

/** `datetime-local` inputs want `YYYY-MM-DDTHH:mm` in the viewer's local time
 *  zone (browsers parse/serialize that string as local time already — no
 *  manual IST math needed here). */
function toLocalInputValue(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Edit a post's copy, on-image text, image preview, and publish schedule. */
export function PostEditDialog({
  post,
  onClose,
}: {
  post: SocialPostRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hook, setHook] = useState("");
  const [caption, setCaption] = useState("");
  const [captionLong, setCaptionLong] = useState("");
  const [cta, setCta] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [altText, setAltText] = useState("");
  const [headline, setHeadline] = useState("");
  const [support, setSupport] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");

  useEffect(() => {
    if (post) {
      setHook(post.hook);
      setCaption(post.caption);
      setCaptionLong(post.captionLong ?? "");
      setCta(post.cta);
      setHashtags(post.hashtags.join(" "));
      setAltText(post.altText);
      setHeadline(post.headline ?? "");
      setSupport(post.support ?? "");
      setScheduledFor(toLocalInputValue(post.scheduledFor));
    }
  }, [post]);

  const textChanged = post && (headline !== (post.headline ?? "") || support !== (post.support ?? ""));

  const save = () => {
    if (!post) return;
    start(async () => {
      const res = await updateSocialPost({
        id: post.id,
        hook,
        caption,
        captionLong,
        cta,
        hashtags: hashtags
          .split(/[\s,]+/)
          .map((t) => (t.startsWith("#") ? t : t ? `#${t}` : ""))
          .filter(Boolean),
        altText,
        imageUrls: post.imageUrls,
        headline,
        support,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      });
      if (res.ok) {
        toast.success(textChanged ? "Post updated — cover re-rendered with the new text." : "Post updated.");
        onClose();
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't save.");
      }
    });
  };

  return (
    <Dialog open={Boolean(post)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit post</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          {post?.imageUrls[0] ? (
            <div className="flex flex-col gap-2">
              <Image
                src={post.imageUrls[0]}
                alt={post.altText || "Post cover preview"}
                width={160}
                height={200}
                className="w-full rounded-lg border object-cover"
                unoptimized
              />
              {post.imageUrls.length > 1 && (
                <p className="text-center text-xs text-muted-foreground">
                  +{post.imageUrls.length - 1} carousel frame{post.imageUrls.length > 2 ? "s" : ""}
                </p>
              )}
              {textChanged && (
                <p className="text-center text-xs text-primary">Will re-render on save</p>
              )}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
              No image
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-headline">On-image headline</Label>
                <Input id="edit-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={32} />
              </div>
              <div>
                <Label htmlFor="edit-support">On-image subhead</Label>
                <Input id="edit-support" value={support} onChange={(e) => setSupport(e.target.value)} maxLength={40} />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-schedule">Publish date &amp; time</Label>
              <Input
                id="edit-schedule"
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="edit-hook">Hook</Label>
            <Input id="edit-hook" value={hook} onChange={(e) => setHook(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label htmlFor="edit-caption">Caption</Label>
            <Textarea id="edit-caption" value={caption} onChange={(e) => setCaption(e.target.value)} rows={5} maxLength={2200} />
          </div>
          <div>
            <Label htmlFor="edit-long">Long version</Label>
            <Textarea id="edit-long" value={captionLong} onChange={(e) => setCaptionLong(e.target.value)} rows={4} maxLength={4000} />
          </div>
          <div>
            <Label htmlFor="edit-cta">Call to action</Label>
            <Input id="edit-cta" value={cta} onChange={(e) => setCta(e.target.value)} maxLength={60} />
          </div>
          <div>
            <Label htmlFor="edit-tags">Hashtags</Label>
            <Textarea id="edit-tags" value={hashtags} onChange={(e) => setHashtags(e.target.value)} rows={2} />
          </div>
          <div>
            <Label htmlFor="edit-alt">Alt text</Label>
            <Input id="edit-alt" value={altText} onChange={(e) => setAltText(e.target.value)} maxLength={200} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !caption.trim()}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
