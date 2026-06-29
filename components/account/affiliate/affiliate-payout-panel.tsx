"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePayoutDetails, requestPayout } from "@/lib/actions/affiliate";
import { PAYOUT_METHODS } from "@/lib/validations/affiliate";
import { formatPrice } from "@/lib/format";

type Values = {
  payoutMethod: string;
  upiId: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  accountName: string;
};

const METHOD_LABEL: Record<string, string> = {
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  RAZORPAYX: "RazorpayX (coming soon)",
};

export function AffiliatePayoutPanel({
  available,
  minPayout,
  initial,
}: {
  available: number;
  minPayout: number;
  initial: Partial<Values>;
}) {
  const router = useRouter();
  const [savingDetails, setSavingDetails] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const { register, handleSubmit, watch } = useForm<Values>({
    defaultValues: {
      payoutMethod: initial.payoutMethod ?? "UPI",
      upiId: initial.upiId ?? "",
      bankName: initial.bankName ?? "",
      bankAccount: initial.bankAccount ?? "",
      bankIfsc: initial.bankIfsc ?? "",
      accountName: initial.accountName ?? "",
    },
  });
  const method = watch("payoutMethod");

  async function saveDetails(v: Values) {
    setSavingDetails(true);
    const res = await updatePayoutDetails(v);
    setSavingDetails(false);
    if (res.ok) {
      toast.success("Payout details saved");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function onRequest() {
    setRequesting(true);
    const res = await requestPayout();
    setRequesting(false);
    if (res.ok) {
      toast.success("Payout requested — we'll process it shortly.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const field = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";
  const canRequest = available >= minPayout;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Available to withdraw</p>
            <p className="text-2xl font-bold">{formatPrice(available)}</p>
          </div>
          <Button onClick={onRequest} disabled={!canRequest || requesting} className="gap-2">
            {requesting ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
            Request payout
          </Button>
        </div>
        {!canRequest && (
          <p className="mt-2 text-xs text-muted-foreground">
            Minimum payout is {formatPrice(minPayout)}. Keep referring to reach the threshold.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit(saveDetails)} className="space-y-3 rounded-2xl border p-5">
        <p className="text-sm font-semibold">Payout details</p>
        <div className="space-y-1.5">
          <Label htmlFor="payoutMethod">Method</Label>
          <select id="payoutMethod" {...register("payoutMethod")} className={field}>
            {PAYOUT_METHODS.map((m) => (
              <option key={m} value={m} disabled={m === "RAZORPAYX"}>
                {METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </div>

        {method === "UPI" ? (
          <div className="space-y-1.5">
            <Label htmlFor="upiId">UPI ID</Label>
            <Input id="upiId" placeholder="name@bank" {...register("upiId")} />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="accountName">Account name</Label>
              <Input id="accountName" {...register("accountName")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankName">Bank name</Label>
              <Input id="bankName" {...register("bankName")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankAccount">Account number</Label>
              <Input id="bankAccount" {...register("bankAccount")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankIfsc">IFSC</Label>
              <Input id="bankIfsc" {...register("bankIfsc")} />
            </div>
          </div>
        )}

        <Button type="submit" variant="outline" size="sm" disabled={savingDetails} className="gap-2">
          {savingDetails && <Loader2 className="size-4 animate-spin" />}
          Save details
        </Button>
      </form>
    </div>
  );
}
