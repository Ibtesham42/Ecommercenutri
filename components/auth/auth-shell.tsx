"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Mail,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/components/auth/login-form";
import { GoogleButton } from "@/components/auth/google-button";
import { OtpInput } from "@/components/auth/otp-input";
import { AuthAlert } from "@/components/auth/auth-input";
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

  return (
    <Card className="animate-fade-up overflow-hidden rounded-3xl shadow-elev-2 ring-foreground/5 max-sm:[--card-spacing:--spacing(6)]">
      {/* ---------------------------------------------------------- phone -- */}
      {view === "phone" && (
        <div key="phone" className="animate-fade-up">
          <CardHeader className="text-center">
            <CardTitle className="font-heading text-3xl tracking-tight">
              Welcome to Nutriyet
            </CardTitle>
            <CardDescription className="text-[15px] leading-relaxed">
              Log in or sign up in seconds — your healthy snacks are waiting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <AuthAlert kind="error">{error}</AuthAlert>}

            <div
              className={cn(
                "flex h-13 items-center overflow-hidden rounded-xl border bg-background shadow-elev-1 transition-all",
                "focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/25",
              )}
            >
              <label
                htmlFor="login-phone"
                className="grid h-full shrink-0 place-items-center border-r bg-secondary/50 px-3.5 text-[15px] font-semibold text-foreground/80"
              >
                +91
              </label>
              <input
                ref={phoneInputRef}
                id="login-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="10-digit mobile number"
                value={rawPhone}
                onChange={(e) => setRawPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && rawPhone.length === 10) sendCode();
                }}
                className="h-full w-full min-w-0 flex-1 bg-transparent px-3.5 text-base font-medium tracking-wide outline-none placeholder:font-normal placeholder:text-muted-foreground/70"
              />
            </div>

            <Button
              onClick={() => sendCode()}
              disabled={rawPhone.length !== 10 || pending}
              className="btn-rich h-12 w-full gap-2 text-[15px] font-semibold shadow-elev-2"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageSquareText className="size-4" />
              )}
              Continue
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 shrink-0 text-primary" />
              We&apos;ll text you a one-time code — no password needed.
            </p>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              onClick={() => {
                setError(null);
                setView("email");
              }}
              variant="outline"
              className="btn-rich h-12 w-full gap-2 rounded-xl bg-background text-[15px] font-medium shadow-elev-1"
            >
              <Mail className="size-4" /> Continue with Email
            </Button>
          </CardContent>
          <CardFooter>
            <p className="w-full text-center text-xs leading-relaxed text-muted-foreground">
              By continuing you agree to our{" "}
              <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
                Terms
              </Link>{" "}
              &amp;{" "}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                Privacy Policy
              </Link>
              .
            </p>
          </CardFooter>
        </div>
      )}

      {/* ------------------------------------------------------------ otp -- */}
      {view === "otp" && (
        <div key="otp" className="animate-fade-up">
          <CardHeader>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setCode("");
                setView("phone");
                // Let the phone view mount, then put the caret back.
                setTimeout(() => phoneInputRef.current?.focus(), 0);
              }}
              className="inline-flex items-center gap-1.5 self-start py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Change number
            </button>
            <CardTitle className="mt-1 font-heading text-2xl tracking-tight">
              Enter the code
            </CardTitle>
            <CardDescription className="text-[15px]">
              Sent by SMS to <span className="font-semibold text-foreground">{prettyPhone}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            {pending && (
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" /> Verifying…
              </p>
            )}

            <div className="text-center text-sm text-muted-foreground">
              {seconds > 0 ? (
                <>
                  Resend code in{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    0:{String(seconds).padStart(2, "0")}
                  </span>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => sendCode(true)}
                  disabled={pending}
                  className="py-1.5 font-semibold text-primary transition-colors hover:text-primary/80"
                >
                  Resend code
                </button>
              )}
            </div>
          </CardContent>
        </div>
      )}

      {/* ---------------------------------------------------------- email -- */}
      {view === "email" && (
        <div key="email" className="animate-fade-up">
          <CardHeader className="text-center">
            {phoneEnabled && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setView("phone");
                }}
                className="inline-flex items-center gap-1.5 self-start py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-4" /> Sign in with mobile number
              </button>
            )}
            <CardTitle className={cn("font-heading text-3xl tracking-tight", phoneEnabled && "mt-1")}>
              {phoneEnabled ? "Continue with email" : "Welcome back"}
            </CardTitle>
            <CardDescription className="text-[15px]">
              Sign in to continue your healthy journey 🌿
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {googleEnabled && (
              <>
                <GoogleButton callbackUrl={callbackUrl} />
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
              </>
            )}
            <LoginForm callbackUrl={callbackUrl} />
          </CardContent>
          <CardFooter className="flex-col gap-2.5 text-sm text-muted-foreground">
            <span>Don&apos;t have an account?</span>
            <Link
              href="/register"
              className="btn-rich btn-rich-gold inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 text-base font-semibold text-gold-foreground shadow-elev-1 transition hover:bg-gold/20 focus-visible:bg-gold/20 dark:text-gold"
            >
              Sign Up <ArrowRight className="size-4" />
            </Link>
          </CardFooter>
        </div>
      )}
    </Card>
  );
}
