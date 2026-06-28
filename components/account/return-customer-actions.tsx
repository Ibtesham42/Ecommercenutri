"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { ReturnStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ReturnMediaUpload } from "@/components/account/return-media-upload";
import { cancelReturn, submitReturnInfo } from "@/lib/actions/returns";
import { canCustomerCancelReturn } from "@/lib/return-status";

export function ReturnCustomerActions({
  returnNumber,
  status,
  cloudinaryReady,
}: {
  returnNumber: string;
  status: ReturnStatus;
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [media, setMedia] = useState<string[]>([]);

  async function onCancel() {
    setPending(true);
    const res = await cancelReturn({ returnNumber });
    setPending(false);
    if (res.ok) {
      toast.success("Return cancelled");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function onSubmitInfo() {
    if (!message.trim()) return toast.error("Add a message.");
    setPending(true);
    const res = await submitReturnInfo({ returnNumber, message: message.trim(), media });
    setPending(false);
    if (res.ok) {
      toast.success("Information submitted");
      setMessage("");
      setMedia([]);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-3">
      {status === "INFO_REQUESTED" && (
        <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            We need a little more information to continue.
          </p>
          <Textarea
            placeholder="Add the requested details…"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
          />
          <ReturnMediaUpload value={media} onChange={setMedia} cloudinaryReady={cloudinaryReady} />
          <Button onClick={onSubmitInfo} disabled={pending} size="sm" className="gap-2">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Submit information
          </Button>
        </div>
      )}

      {canCustomerCancelReturn(status) && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
              <XCircle className="size-4" /> Cancel return
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this return request?</AlertDialogTitle>
              <AlertDialogDescription>
                Return {returnNumber} will be withdrawn. You can request a new return later if
                the item is still within the return window.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Keep return</AlertDialogCancel>
              <Button variant="destructive" onClick={onCancel} disabled={pending} className="gap-2">
                {pending && <Loader2 className="size-4 animate-spin" />}
                Cancel return
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
