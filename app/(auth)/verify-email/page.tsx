import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { AuthHeader, authPrimaryClass } from "@/components/auth/auth-header";
import { buttonVariants } from "@/components/ui/button";
import { verifyEmailToken } from "@/lib/actions/auth";
import { cn, safeRedirectPath } from "@/lib/utils";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; next?: string }>;
}) {
  const { token, next: rawNext } = await searchParams;
  // Sign-in (or straight through, if already signed in) back to where the
  // shopper started — e.g. /spin to claim an offer. No `next` → unchanged.
  const next = safeRedirectPath(rawNext, "/account");
  const continueHref = next === "/account" ? "/login" : `/login?callbackUrl=${encodeURIComponent(next)}`;
  const result = token
    ? await verifyEmailToken(token)
    : { ok: false, message: "Missing verification token." };
  const Icon = result.ok ? CheckCircle2 : XCircle;

  return (
    <div className="animate-fade-up">
      <span
        className={cn(
          "mb-6 grid size-12 place-items-center rounded-full",
          result.ok ? "bg-sage text-primary" : "bg-destructive/10 text-destructive",
        )}
      >
        <Icon className="size-6" strokeWidth={1.75} aria-hidden />
      </span>
      <AuthHeader
        title={result.ok ? "Email verified" : "Verification failed"}
        description={result.message}
      />
      <Link
        href={result.ok ? continueHref : "/register"}
        className={cn(buttonVariants(), authPrimaryClass)}
      >
        {result.ok ? "Continue to sign in" : "Back to sign up"}
      </Link>
    </div>
  );
}
