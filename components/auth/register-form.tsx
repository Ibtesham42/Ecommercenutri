"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { registerAction, type AuthActionState } from "@/lib/actions/auth";
import { AuthAlert } from "@/components/auth/auth-input";
import { AuthField, AuthPasswordField, AuthSubmit } from "@/components/auth/auth-field";
import { authPrimaryClass } from "@/components/auth/auth-header";
import { PasswordStrength, LiveCheck } from "@/components/auth/password-strength";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RegisterForm({
  callbackUrl = "/account",
  loginHref = "/login",
}: {
  callbackUrl?: string;
  loginHref?: string;
}) {
  const [state, action] = useActionState<AuthActionState, FormData>(
    registerAction,
    undefined,
  );
  // All fields controlled so a server-side rejection (e.g. email already
  // registered) doesn't wipe the form — React resets uncontrolled fields.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && password !== confirm;
  const matched = confirm.length > 0 && !mismatch && password.length >= 8;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Validate before the server action runs.
    if (password.length < 8) {
      e.preventDefault();
      setClientError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      e.preventDefault();
      setClientError("Passwords do not match. Please re-enter them.");
      return;
    }
    setClientError(null);
  }

  const error = clientError ?? state?.error;

  return (
    <form action={action} onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && <AuthAlert kind="error">{error}</AuthAlert>}
      {state?.success && <AuthAlert kind="success">{state.success}</AuthAlert>}
      {/* Account is ready — offer the next step right where they're looking.
          Carries the callback (e.g. claiming a Spin & Win offer) along. */}
      {state?.success && (
        <Link href={loginHref} className={cn(buttonVariants(), authPrimaryClass)}>
          {callbackUrl !== "/account" ? "Sign in to continue" : "Sign in"}
        </Link>
      )}
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <AuthField
        id="name"
        name="name"
        label="Full name"
        autoComplete="name"
        placeholder="e.g. Priya Sharma"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <AuthField
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <AuthPasswordField
        id="password"
        name="password"
        label="Password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (clientError) setClientError(null);
        }}
        placeholder="At least 8 characters"
        autoComplete="new-password"
        minLength={8}
        required
        invalid={clientError?.startsWith("Password must") || undefined}
      >
        <PasswordStrength password={password} />
        <ul className="grid gap-1.5 pt-0.5" aria-label="Password requirements">
          <LiveCheck ok={password.length >= 8} label="At least 8 characters" />
          <LiveCheck
            ok={/\d/.test(password) || /[^a-zA-Z0-9]/.test(password)}
            label="A number or symbol (recommended)"
          />
        </ul>
      </AuthPasswordField>

      <AuthPasswordField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm password"
        value={confirm}
        onChange={(e) => {
          setConfirm(e.target.value);
          if (clientError) setClientError(null);
        }}
        placeholder="Re-enter your password"
        autoComplete="new-password"
        minLength={8}
        required
        invalid={mismatch}
        hint={mismatch ? "Passwords do not match." : matched ? "Passwords match." : undefined}
      />

      <AuthSubmit pendingLabel="Creating your account…">Create account</AuthSubmit>
    </form>
  );
}
