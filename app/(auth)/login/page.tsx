import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { getCurrentUser } from "@/lib/auth";
import { isConfigured } from "@/lib/env";
import { isPhoneAuthEnabled } from "@/lib/otp";
import { safeRedirectPath } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl: rawCallback, error } = await searchParams;
  const callbackUrl = safeRedirectPath(rawCallback, "/account");
  const user = await getCurrentUser();
  if (user) redirect(callbackUrl);

  return (
    <AuthShell
      callbackUrl={callbackUrl}
      googleEnabled={isConfigured.google()}
      phoneEnabled={isPhoneAuthEnabled()}
      notice={authErrorMessage(error)}
    />
  );
}

/** Auth.js redirects failed sign-ins here as `?error=<Type>`; map the ones a
 *  shopper can act on. Unknown values show a generic line (never echoed raw). */
function authErrorMessage(error: string | undefined): string | null {
  if (!error) return null;
  if (error === "OAuthAccountNotLinked" || error === "AccessDenied") {
    return "An account with this email already exists. Sign in with your email and password (or reset it) — you can use Google once your email is verified.";
  }
  return "We couldn't sign you in. Please try again.";
}
