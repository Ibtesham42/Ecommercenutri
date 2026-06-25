"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOwnEmail, updateOwnPassword } from "@/lib/actions/admin/settings";

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit } = useForm<{ email: string }>({
    defaultValues: { email: currentEmail },
  });

  async function onSubmit(v: { email: string }) {
    setSaving(true);
    const res = await updateOwnEmail({ email: v.email });
    setSaving(false);
    if (res.ok) {
      toast.success("Login email updated");
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="ownEmail">Login email</Label>
        <Input id="ownEmail" type="email" {...register("email", { required: true })} />
      </div>
      <Button type="submit" disabled={saving} className="gap-2">
        {saving && <Loader2 className="size-4 animate-spin" />}
        Update email
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm<{
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }>();

  async function onSubmit(v: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    setSaving(true);
    const res = await updateOwnPassword(v);
    setSaving(false);
    if (res.ok) {
      toast.success("Password updated");
      reset();
    } else toast.error(res.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="curPw">Current password</Label>
        <Input id="curPw" type="password" autoComplete="current-password" {...register("currentPassword", { required: true })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="newPw">New password</Label>
          <Input id="newPw" type="password" autoComplete="new-password" {...register("newPassword", { required: true })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confPw">Confirm new password</Label>
          <Input id="confPw" type="password" autoComplete="new-password" {...register("confirmPassword", { required: true })} />
        </div>
      </div>
      <Button type="submit" disabled={saving} className="gap-2">
        {saving && <Loader2 className="size-4 animate-spin" />}
        Update password
      </Button>
    </form>
  );
}
