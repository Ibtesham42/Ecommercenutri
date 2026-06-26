"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { registerAction, type AuthActionState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

/** Password input with a show/hide toggle. */
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
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          minLength={8}
          required
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          tabIndex={-1}
          className="absolute right-0 top-0 grid h-full w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState<AuthActionState, FormData>(
    registerAction,
    undefined,
  );
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
    <form action={action} onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {state?.success && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {state.success}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" autoComplete="name" placeholder="Jane Doe" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </div>

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
        {mismatch && (
          <p className="mt-1.5 text-xs text-destructive">Passwords do not match.</p>
        )}
        {confirm.length > 0 && !mismatch && password.length >= 8 && (
          <p className="mt-1.5 text-xs text-primary">Passwords match.</p>
        )}
      </div>

      <SubmitButton className="h-12 text-base font-semibold shadow-elev-1">
        Create account
      </SubmitButton>
    </form>
  );
}
