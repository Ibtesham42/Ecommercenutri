"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, User, Mail, Lock } from "lucide-react";
import { registerAction, type AuthActionState } from "@/lib/actions/auth";
import { Label } from "@/components/ui/label";
import { AuthInput, AuthAlert } from "@/components/auth/auth-input";
import { PasswordStrength, LiveCheck } from "@/components/auth/password-strength";
import { SubmitButton } from "@/components/auth/submit-button";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Password input with a show/hide toggle (visible on all breakpoints — this
 *  matches the previous desktop behavior exactly). */
function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <AuthInput
        id={id}
        name={name}
        type={show ? "text" : "password"}
        icon={Lock}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={8}
        required
        className="pr-10 max-sm:pr-12"
        rightSlot={
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            tabIndex={-1}
            className="absolute right-0 top-0 grid h-full w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground max-sm:w-12"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        }
      />
    </div>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState<AuthActionState, FormData>(
    registerAction,
    undefined,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && password !== confirm;

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
    <form action={action} onSubmit={onSubmit} className="space-y-4 max-sm:space-y-5" noValidate>
      {error && <AuthAlert kind="error">{error}</AuthAlert>}
      {state?.success && <AuthAlert kind="success">{state.success}</AuthAlert>}

      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <AuthInput id="name" name="name" icon={User} autoComplete="name" placeholder="Jane Doe" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <AuthInput
          id="email"
          name="email"
          type="email"
          icon={Mail}
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <PasswordField
          id="password"
          name="password"
          label="Password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            if (clientError) setClientError(null);
          }}
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />
        {/* Mobile-only animated strength meter (desktop form unchanged). */}
        <PasswordStrength password={password} />
      </div>

      <div>
        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm password"
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            if (clientError) setClientError(null);
          }}
          placeholder="Re-enter your password"
          autoComplete="new-password"
        />
        {/* Desktop keeps the original inline messages… */}
        {mismatch && (
          <p className="mt-1.5 text-xs text-destructive max-sm:hidden">Passwords do not match.</p>
        )}
        {confirm.length > 0 && !mismatch && password.length >= 8 && (
          <p className="mt-1.5 text-xs text-primary max-sm:hidden">Passwords match.</p>
        )}
      </div>

      {/* …mobile gets live validation as you type. */}
      {(email || password || confirm) && (
        <ul className="space-y-1 rounded-xl bg-accent/40 px-3.5 py-3 sm:hidden" aria-live="polite">
          <LiveCheck ok={EMAIL_RE.test(email)} label="Valid email" />
          <LiveCheck ok={password.length >= 8} label="At least 8 characters" />
          <LiveCheck ok={confirm.length > 0 && password === confirm} label="Passwords match" />
        </ul>
      )}

      <SubmitButton className="h-12 text-base font-semibold shadow-elev-1">
        Sign Up
      </SubmitButton>
    </form>
  );
}
