"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFieldClass, authPrimaryClass } from "@/components/auth/auth-header";
import { cn } from "@/lib/utils";

/**
 * Field primitives for the auth pages only. The quiz sign-up and account
 * security forms keep using `AuthInput` / `PasswordField` / `SubmitButton`,
 * so restyling here never shifts those surfaces.
 */

type FieldProps = Omit<React.ComponentProps<typeof Input>, "id"> & {
  id: string;
  label: string;
  /** Right-aligned element on the label row (e.g. "Forgot password?"). */
  labelAside?: React.ReactNode;
  /** Helper / validation text under the field. */
  hint?: React.ReactNode;
  invalid?: boolean;
};

export function AuthField({
  id,
  label,
  labelAside,
  hint,
  invalid,
  className,
  ...props
}: FieldProps) {
  const hintId = `${id}-hint`;
  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={id} aside={labelAside}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={hint ? hintId : undefined}
        className={cn(authFieldClass, className)}
        {...props}
      />
      {hint && <FieldHint id={hintId} invalid={invalid}>{hint}</FieldHint>}
    </div>
  );
}

/** Password field with a keyboard-reachable show/hide toggle. */
export function AuthPasswordField({
  id,
  label,
  labelAside,
  hint,
  invalid,
  className,
  children,
  ...props
}: Omit<FieldProps, "type"> & { children?: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const hintId = `${id}-hint`;
  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={id} aside={labelAside}>
        {label}
      </FieldLabel>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? hintId : undefined}
          className={cn(authFieldClass, "pr-12", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          aria-controls={id}
          className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      </div>
      {children}
      {hint && <FieldHint id={hintId} invalid={invalid}>{hint}</FieldHint>}
    </div>
  );
}

function FieldLabel({
  htmlFor,
  aside,
  children,
}: {
  htmlFor: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground/85">
        {children}
      </Label>
      {aside}
    </div>
  );
}

function FieldHint({
  id,
  invalid,
  children,
}: {
  id: string;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <p
      id={id}
      className={cn("text-[13px] leading-snug", invalid ? "text-destructive" : "text-muted-foreground")}
    >
      {children}
    </p>
  );
}

export function AuthSubmit({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className={authPrimaryClass}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? pendingLabel : children}
    </Button>
  );
}
