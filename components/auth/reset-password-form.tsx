"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import {
  resetPasswordAction,
  type AuthActionState,
} from "@/lib/actions/auth";
import { Label } from "@/components/ui/label";
import { AuthInput, AuthAlert } from "@/components/auth/auth-input";
import { PasswordStrength } from "@/components/auth/password-strength";
import { SubmitButton } from "@/components/auth/submit-button";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<AuthActionState, FormData>(
    resetPasswordAction,
    undefined,
  );
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-4 max-sm:space-y-5">
      {state?.error && <AuthAlert kind="error">{state.error}</AuthAlert>}
      {state?.success ? (
        <>
          <AuthAlert kind="success">{state.success}</AuthAlert>
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 max-sm:h-12 max-sm:rounded-xl max-sm:text-base max-sm:font-semibold max-sm:shadow-elev-1"
          >
            Go to sign in
          </Link>
        </>
      ) : (
        <>
          <input type="hidden" name="token" value={token} />
          <div>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <AuthInput
                id="password"
                name="password"
                type={show ? "text" : "password"}
                icon={Lock}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                className="max-sm:pr-12"
                rightSlot={
                  // Mobile-only visibility toggle (desktop page stays as before).
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Hide password" : "Show password"}
                    aria-pressed={show}
                    tabIndex={-1}
                    className="absolute right-0 top-0 grid h-full w-12 place-items-center text-muted-foreground transition-colors hover:text-foreground sm:hidden"
                  >
                    {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                  </button>
                }
              />
            </div>
            {/* Mobile-only animated strength meter. */}
            <PasswordStrength password={password} />
          </div>
          <SubmitButton>Update password</SubmitButton>
        </>
      )}
    </form>
  );
}
