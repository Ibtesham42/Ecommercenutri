"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { AuthInput } from "@/components/auth/auth-input";

/**
 * Password input with a show/hide toggle — a standalone, reusable version of the
 * field pattern used in the auth forms (used by the quiz signup). Uncontrolled
 * by default (posts via the form); pass value/onChange to control it.
 */
export function PasswordField({
  id,
  name,
  label,
  placeholder,
  autoComplete,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  autoComplete: string;
  value?: string;
  onChange?: (v: string) => void;
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
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        minLength={8}
        required
        className="pr-10 max-sm:pr-12"
        rightSlot={
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
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
