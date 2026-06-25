"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { saveAddress, type AccountState } from "@/lib/actions/account";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

export type AddressData = {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  type: "HOME" | "WORK" | "OTHER";
  isDefault: boolean;
};

export function AddressForm({
  address,
  onSuccess,
}: {
  address?: AddressData | null;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState<AccountState, FormData>(
    saveAddress,
    undefined,
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      onSuccess();
    }
  }, [state, onSuccess]);

  return (
    <form action={action} className="space-y-3">
      {state?.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {address?.id && <input type="hidden" name="id" value={address.id} />}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" defaultValue={address?.fullName} required />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={address?.phone} required />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="line1">Address line 1</Label>
          <Input id="line1" name="line1" defaultValue={address?.line1} required />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="line2">Address line 2 (optional)</Label>
          <Input id="line2" name="line2" defaultValue={address?.line2 ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={address?.city} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="state">State</Label>
          <Input id="state" name="state" defaultValue={address?.state} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pincode">Pincode</Label>
          <Input
            id="pincode"
            name="pincode"
            inputMode="numeric"
            defaultValue={address?.pincode}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            name="type"
            defaultValue={address?.type ?? "HOME"}
            className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="HOME">Home</option>
            <option value="WORK">Work</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={address?.isDefault}
          className="size-4 rounded border"
        />
        Set as default address
      </label>

      <SubmitButton>Save address</SubmitButton>
    </form>
  );
}
