"use client";

import { useActionState, useState } from "react";
import {
  requestPasswordResetAction,
  type AuthActionState,
} from "@/lib/actions/auth";
import { AuthAlert } from "@/components/auth/auth-input";
import { AuthField, AuthSubmit } from "@/components/auth/auth-field";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<AuthActionState, FormData>(
    requestPasswordResetAction,
    undefined,
  );
  // Controlled: React resets uncontrolled fields after a form action.
  const [email, setEmail] = useState("");

  return (
    <form action={action} className="space-y-5">
      {state?.error && <AuthAlert kind="error">{state.error}</AuthAlert>}
      {state?.success && <AuthAlert kind="success">{state.success}</AuthAlert>}

      <AuthField
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        invalid={Boolean(state?.error)}
        required
      />

      <AuthSubmit pendingLabel="Sending link…">Send reset link</AuthSubmit>
    </form>
  );
}
