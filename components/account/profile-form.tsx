"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateProfile, type AccountState } from "@/lib/actions/account";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";
import { cn } from "@/lib/utils";

const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
] as const;

export function ProfileForm({
  defaultName,
  defaultGender,
  defaultDob,
}: {
  defaultName: string;
  defaultGender: string | null;
  defaultDob: string | null; // YYYY-MM-DD
}) {
  const [state, action] = useActionState<AccountState, FormData>(
    updateProfile,
    undefined,
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" defaultValue={defaultName} autoComplete="name" required />
      </div>

      <div className="space-y-2">
        <Label>Gender</Label>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Gender">
          {GENDERS.map((g) => (
            <label
              key={g.value}
              className={cn(
                "flex h-11 cursor-pointer items-center justify-center rounded-xl border bg-background text-sm font-medium text-muted-foreground shadow-elev-1 transition-all",
                "hover:border-primary/40 hover:text-foreground motion-safe:active:scale-[0.97]",
                "has-checked:border-primary has-checked:bg-primary/5 has-checked:font-semibold has-checked:text-primary",
              )}
            >
              <input
                type="radio"
                name="gender"
                value={g.value}
                defaultChecked={defaultGender === g.value}
                className="sr-only"
              />
              {g.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dob">Date of birth</Label>
        <Input
          id="dob"
          name="dob"
          type="date"
          defaultValue={defaultDob ?? ""}
          max={new Date().toISOString().slice(0, 10)}
          autoComplete="bday"
        />
      </div>

      <SubmitButton className="sm:w-auto">Save changes</SubmitButton>
    </form>
  );
}
