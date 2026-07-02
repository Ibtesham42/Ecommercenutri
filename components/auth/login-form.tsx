"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { loginAction, type AuthActionState } from "@/lib/actions/auth";
import { Label } from "@/components/ui/label";
import { AuthInput, AuthAlert } from "@/components/auth/auth-input";
import { SubmitButton } from "@/components/auth/submit-button";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action] = useActionState<AuthActionState, FormData>(
    loginAction,
    undefined,
  );
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-4 max-sm:space-y-5">
      {state?.error && <AuthAlert kind="error">{state.error}</AuthAlert>}
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-primary max-sm:py-1 max-sm:text-sm"
          >
            Forgot password?
          </Link>
        </div>
        <AuthInput
          id="password"
          name="password"
          type={show ? "text" : "password"}
          icon={Lock}
          autoComplete="current-password"
          placeholder="••••••••"
          required
          className="max-sm:pr-12"
          rightSlot={
            // Mobile-only visibility toggle (desktop login stays as before).
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

      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}
