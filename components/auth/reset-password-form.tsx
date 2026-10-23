"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  resetPasswordAction,
  type AuthActionState,
} from "@/lib/actions/auth";
import { AuthAlert } from "@/components/auth/auth-input";
import { AuthPasswordField, AuthSubmit } from "@/components/auth/auth-field";
import { authPrimaryClass } from "@/components/auth/auth-header";
import { PasswordStrength } from "@/components/auth/password-strength";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<AuthActionState, FormData>(
    resetPasswordAction,
    undefined,
  );
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="space-y-5">
      {state?.error && <AuthAlert kind="error">{state.error}</AuthAlert>}
      {state?.success ? (
        <>
          <AuthAlert kind="success">{state.success}</AuthAlert>
          <Link href="/login" className={cn(buttonVariants(), authPrimaryClass)}>
            Go to sign in
          </Link>
        </>
      ) : (
        <>
          <input type="hidden" name="token" value={token} />
          <AuthPasswordField
            id="password"
            name="password"
            label="New password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          >
            <PasswordStrength password={password} />
          </AuthPasswordField>
          <AuthSubmit pendingLabel="Updating…">Update password</AuthSubmit>
        </>
      )}
    </form>
  );
}
