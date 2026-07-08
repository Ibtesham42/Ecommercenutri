"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

/** Edit the generated copy of a post. Images are preserved as-is. */
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

  useEffect(() => {
    if (post) {
      setHook(post.hook);
      setCaption(post.caption);
      setCaptionLong(post.captionLong ?? "");
      setCta(post.cta);
      setHashtags(post.hashtags.join(" "));
      setAltText(post.altText);
    }
  }, [post]);

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
      });
      if (res.ok) {
        toast.success("Post updated.");
        onClose();
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't save.");
      }
    });
  };

  return (
    <Dialog open={Boolean(post)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit post</DialogTitle>
        </DialogHeader>
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
