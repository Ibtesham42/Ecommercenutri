"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/components/auth/login-form";
import { GoogleButton } from "@/components/auth/google-button";
import { OtpInput } from "@/components/auth/otp-input";
import { AuthAlert } from "@/components/auth/auth-input";
import {
  AuthDivider,
  AuthHeader,
  AuthLegal,
  AuthSwitch,
  authLinkClass,
  authPrimaryClass,
  authSecondaryClass,
} from "@/components/auth/auth-header";
import { requestOtpAction, phoneOtpLoginAction } from "@/lib/actions/phone-auth";
import { cn } from "@/lib/utils";

type View = "phone" | "otp" | "email";

const RESEND_SECONDS = 30;

/**
 * The sign-in experience. Phone-OTP first (when available), with email +
 * Google as a full alternate panel — all client-side view switches, no
 * navigation, so the flow feels native. Falls back to the classic email-first
 * card when phone auth is disabled (production without an SMS provider).
 */
export function AuthShell({
  callbackUrl,
  googleEnabled,
  phoneEnabled,
}: {
  callbackUrl: string;
  googleEnabled: boolean;
  phoneEnabled: boolean;
}) {
  const [view, setView] = useState<View>(phoneEnabled ? "phone" : "email");
  const [rawPhone, setRawPhone] = useState("");
  const [phone, setPhone] = useState(""); // normalized +91… (from the server)
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [pending, startTransition] = useTransition();
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Resend countdown for the OTP view.
  useEffect(() => {
    if (view !== "otp" || seconds <= 0) return;
    const t = window.setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearInterval(t);
  }, [view, seconds]);

  function sendCode(resend = false) {
    setError(null);
    startTransition(async () => {
      const res = await requestOtpAction({ phone: rawPhone });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPhone(res.phone);
      setCode("");
      setSeconds(RESEND_SECONDS);
      setView("otp");
      if (res.devCode) {
        toast.info(`Dev mode — your OTP is ${res.devCode}`, { duration: 12000 });
      } else if (resend) {
        toast.success("A fresh code is on its way.");
      }
    });
  }

  function verify(finalCode: string) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      // Only ever *returns* on failure — success redirects via NextAuth.
      const res = await phoneOtpLoginAction({ phone, code: finalCode }, callbackUrl);
      setError(res.error);
      setCode("");
    });
  }

  const prettyPhone = phone
    ? `+91 ${phone.slice(3, 8)} ${phone.slice(8)}`
    : "";

  const registerHref =
    callbackUrl === "/account" ? "/register" : `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <div>
      {/* ---------------------------------------------------------- phone -- */}
      {view === "phone" && (
        <div key="phone" className="animate-fade-up">
          <AuthHeader
            title="Sign in or create an account"
            description="Enter your mobile number and we'll text you a one-time code. No password to remember."
          />
          <div className="space-y-5">
            {error && <AuthAlert kind="error">{error}</AuthAlert>}

            <div className="space-y-2">
              <label htmlFor="login-phone" className="text-[13px] font-medium text-foreground/85">
                Mobile number
              </label>
              <div
                className={cn(
                  "flex h-12 items-center overflow-hidden rounded-lg border border-input bg-card transition-[border-color,box-shadow]",
                  "hover:border-foreground/25 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15",
                  error && "border-destructive focus-within:border-destructive focus-within:ring-destructive/15",
                )}
              >
                <span
                  aria-hidden
                  className="grid h-full shrink-0 place-items-center border-r border-input bg-oat/60 px-3.5 text-[15px] font-medium text-foreground/75"
                >
                  +91
                </span>
                <input
                  ref={phoneInputRef}
                  id="login-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="10-digit number"
                  aria-describedby="login-phone-hint"
                  aria-invalid={error ? true : undefined}
                  value={rawPhone}
                  onChange={(e) => setRawPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && rawPhone.length === 10) sendCode();
                  }}
                  className="h-full w-full min-w-0 flex-1 bg-transparent px-3.5 text-[15px] tracking-wide outline-none placeholder:tracking-normal placeholder:text-muted-foreground/65"
                />
              </div>
              <p id="login-phone-hint" className="text-[13px] text-muted-foreground">
                Indian (+91) mobile numbers. New here? We&apos;ll set up your account.
              </p>
            </div>

            <Button
              onClick={() => sendCode()}
              disabled={rawPhone.length !== 10 || pending}
              aria-busy={pending}
              className={authPrimaryClass}
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {pending ? "Sending code…" : "Continue"}
            </Button>

            <AuthDivider />

            <Button
              onClick={() => {
                setError(null);
                setView("email");
              }}
              variant="outline"
              className={authSecondaryClass}
            >
              <Mail className="size-[18px]" aria-hidden /> Continue with email
            </Button>
          </div>
          <div className="mt-8">
            <AuthLegal />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ otp -- */}
      {view === "otp" && (
        <div key="otp" className="animate-fade-up">
          <AuthHeader
            back={
              <BackButton
                onClick={() => {
                  setError(null);
                  setCode("");
                  setView("phone");
                  // Let the phone view mount, then put the caret back.
                  setTimeout(() => phoneInputRef.current?.focus(), 0);
                }}
              >
                Change number
              </BackButton>
            }
            title="Enter your code"
            description={
              <>
                We sent a 6-digit code to{" "}
                <span className="font-medium whitespace-nowrap text-foreground">{prettyPhone}</span>.
              </>
            }
          />
          <div className="space-y-5">
            {error && <AuthAlert kind="error">{error}</AuthAlert>}

            <OtpInput
              value={code}
              onChange={(c) => {
                setError(null);
                setCode(c);
              }}
              onComplete={verify}
              disabled={pending}
              error={Boolean(error)}
            />

            <div className="flex min-h-9 items-center justify-center text-sm text-muted-foreground" aria-live="polite">
              {pending ? (
                <span className="flex items-center gap-2 font-medium">
                  <Loader2 className="size-4 animate-spin text-primary" aria-hidden /> Verifying…
                </span>
              ) : seconds > 0 ? (
                <span>
                  Resend code in{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    0:{String(seconds).padStart(2, "0")}
                  </span>
                </span>
              ) : (
                <span>
                  Didn&apos;t get it?{" "}
                  <button
                    type="button"
                    onClick={() => sendCode(true)}
                    disabled={pending}
                    className={cn(authLinkClass, "py-1.5")}
                  >
                    Resend code
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- email -- */}
      {view === "email" && (
        <div key="email" className="animate-fade-up">
          <AuthHeader
            back={
              phoneEnabled ? (
                <BackButton
                  onClick={() => {
                    setError(null);
                    setView("phone");
                  }}
                >
                  Use mobile number
                </BackButton>
              ) : undefined
            }
            title="Welcome back"
            description="Sign in to track orders, reorder favourites and check out faster."
          />
          <div className="space-y-5">
            {googleEnabled && (
              <>
                <GoogleButton callbackUrl={callbackUrl} className={authSecondaryClass} />
                <AuthDivider label="or with email" />
              </>
            )}
            <LoginForm callbackUrl={callbackUrl} />
          </div>
          <AuthSwitch prompt="New to Nutriyet?" href={registerHref} label="Create an account" />
        </div>
      )}
    </div>
  );
}

function BackButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-1.5 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <ArrowLeft className="size-4" aria-hidden /> {children}
    </button>
  );
}
