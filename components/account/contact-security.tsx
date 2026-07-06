"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, AlertCircle, Loader2, Pencil, X } from "lucide-react";
import {
  updateEmail,
  changePassword,
  requestProfilePhoneOtp,
  confirmProfilePhone,
  type AccountState,
} from "@/lib/actions/account";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/auth/submit-button";
import { PasswordField } from "@/components/auth/password-field";
import { OtpInput } from "@/components/auth/otp-input";
import { isPlaceholderEmail } from "@/lib/phone-account";

function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
      <BadgeCheck className="size-3.5" /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
      <AlertCircle className="size-3.5" /> Unverified
    </span>
  );
}

function EditToggle({
  open,
  onToggle,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
    >
      {open ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
      {open ? "Cancel" : label}
    </button>
  );
}

/* ------------------------------------------------------------------ email */

export function EmailSection({
  email,
  verified,
}: {
  email: string;
  verified: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<AccountState, FormData>(updateEmail, undefined);
  const router = useRouter();
  const placeholder = isPlaceholderEmail(email);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Email</p>
          {placeholder ? (
            <p className="text-sm font-medium text-muted-foreground italic">
              Add your email to secure your account
            </p>
          ) : (
            <p className="truncate font-medium">{email}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!placeholder && <VerifiedBadge verified={verified} />}
          <EditToggle open={open} onToggle={() => setOpen((v) => !v)} label={placeholder ? "Add" : "Change"} />
        </div>
      </div>

      {open && (
        <form action={action} className="animate-fade-up mt-3 space-y-3">
          {state?.error && (
            <p className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">{state.error}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-email">New email address</Label>
            <Input
              id="new-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            We&apos;ll send a verification link to the new address.
          </p>
          <SubmitButton className="sm:w-auto">Save email</SubmitButton>
        </form>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ phone */

type PhoneStage = "idle" | "enter" | "code";

export function PhoneSection({
  phone,
  verified,
}: {
  phone: string | null;
  verified: boolean;
}) {
  const [stage, setStage] = useState<PhoneStage>("idle");
  const [rawPhone, setRawPhone] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  const pretty = phone ? `+91 ${phone.slice(3, 8)} ${phone.slice(8)}` : null;

  function sendCode() {
    setError(null);
    startTransition(async () => {
      const res = await requestProfilePhoneOtp({ phone: rawPhone });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPendingPhone(res.phone);
      setCode("");
      setStage("code");
      if (res.devCode) toast.info(`Dev mode — your OTP is ${res.devCode}`, { duration: 12000 });
    });
  }

  function verify(finalCode: string) {
    setError(null);
    startTransition(async () => {
      const res = await confirmProfilePhone({ phone: pendingPhone, code: finalCode });
      if (res?.error) {
        setError(res.error);
        setCode("");
        return;
      }
      toast.success(res?.success ?? "Phone number verified.");
      setStage("idle");
      setRawPhone("");
      setCode("");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Mobile number</p>
          {pretty ? (
            <p className="font-medium">{pretty}</p>
          ) : (
            <p className="text-sm font-medium text-muted-foreground italic">
              Add your number for OTP login
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {phone && <VerifiedBadge verified={verified} />}
          <EditToggle
            open={stage !== "idle"}
            onToggle={() => {
              setError(null);
              setStage(stage === "idle" ? "enter" : "idle");
            }}
            label={phone ? "Change" : "Add"}
          />
        </div>
      </div>

      {stage === "enter" && (
        <div className="animate-fade-up mt-3 space-y-3">
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">{error}</p>
          )}
          <div className="flex h-12 items-center overflow-hidden rounded-xl border bg-background shadow-elev-1 transition-all focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/25">
            <span className="grid h-full shrink-0 place-items-center border-r bg-secondary/50 px-3.5 text-sm font-semibold text-foreground/80">
              +91
            </span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="10-digit mobile number"
              value={rawPhone}
              onChange={(e) => setRawPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && rawPhone.length === 10) sendCode();
              }}
              aria-label="New mobile number"
              className="h-full w-full min-w-0 flex-1 bg-transparent px-3.5 text-sm font-medium outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          <Button
            onClick={sendCode}
            disabled={rawPhone.length !== 10 || busy}
            className="btn-rich sm:w-auto"
          >
            {busy && <Loader2 className="size-4 animate-spin" />} Send code
          </Button>
        </div>
      )}

      {stage === "code" && (
        <div className="animate-fade-up mt-3 space-y-3">
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">{error}</p>
          )}
          <p className="text-sm text-muted-foreground">
            Enter the code sent to{" "}
            <span className="font-semibold text-foreground">
              +91 {pendingPhone.slice(3, 8)} {pendingPhone.slice(8)}
            </span>
          </p>
          <div className="max-w-xs">
            <OtpInput
              value={code}
              onChange={(c) => {
                setError(null);
                setCode(c);
              }}
              onComplete={verify}
              disabled={busy}
              error={Boolean(error)}
            />
          </div>
          {busy && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" /> Verifying…
            </p>
          )}
          <button
            type="button"
            onClick={() => setStage("enter")}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Use a different number
          </button>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- password */

export function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<AccountState, FormData>(changePassword, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Password</p>
          <p className="text-sm font-medium">
            {hasPassword ? "••••••••" : (
              <span className="text-muted-foreground italic">
                Set a password to also sign in with email
              </span>
            )}
          </p>
        </div>
        <EditToggle open={open} onToggle={() => setOpen((v) => !v)} label={hasPassword ? "Change" : "Set"} />
      </div>

      {open && (
        <form action={action} className="animate-fade-up mt-3 space-y-3">
          {state?.error && (
            <p className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">{state.error}</p>
          )}
          {hasPassword && (
            <PasswordField
              id="current-password"
              name="currentPassword"
              label="Current password"
              autoComplete="current-password"
              placeholder="Your current password"
            />
          )}
          <PasswordField
            id="new-password"
            name="password"
            label="New password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
          <PasswordField
            id="confirm-password"
            name="confirm"
            label="Confirm new password"
            autoComplete="new-password"
            placeholder="Repeat the new password"
          />
          <SubmitButton className="sm:w-auto">
            {hasPassword ? "Change password" : "Set password"}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
