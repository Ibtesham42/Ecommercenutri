"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction, type AuthActionState } from "@/lib/actions/auth";
import { AuthAlert } from "@/components/auth/auth-input";
import { AuthField, AuthPasswordField, AuthSubmit } from "@/components/auth/auth-field";
import { authLinkClass } from "@/components/auth/auth-header";
import { cn } from "@/lib/utils";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action] = useActionState<AuthActionState, FormData>(
    loginAction,
    undefined,
  );
  // Controlled so a failed attempt keeps the address: React resets
  // uncontrolled fields after every form action.
  const [email, setEmail] = useState("");

  return (
    <form action={action} className="space-y-5">
      {state?.error && <AuthAlert kind="error">{state.error}</AuthAlert>}
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

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

      <AuthPasswordField
        id="password"
        name="password"
        label="Password"
        autoComplete="current-password"
        placeholder="Your password"
        invalid={Boolean(state?.error)}
        required
        labelAside={
          <Link href="/forgot-password" className={cn(authLinkClass, "py-0.5 text-[13px]")}>
            Forgot password?
          </Link>
        }
      />

      <AuthSubmit pendingLabel="Signing in…">Sign in</AuthSubmit>
    </form>
  );
}
