"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import {
  requestPasswordResetAction,
  type AuthActionState,
} from "@/lib/actions/auth";
import { Label } from "@/components/ui/label";
import { AuthInput, AuthAlert } from "@/components/auth/auth-input";
import { SubmitButton } from "@/components/auth/submit-button";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<AuthActionState, FormData>(
    requestPasswordResetAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 max-sm:space-y-5">
      {state?.error && <AuthAlert kind="error">{state.error}</AuthAlert>}
      {state?.success && <AuthAlert kind="success">{state.success}</AuthAlert>}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <AuthInput
          id="email"
          name="email"
          type="email"
          icon={Mail}
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </div>

      <SubmitButton>Send reset link</SubmitButton>
    </form>
  );
}
