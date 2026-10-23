import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  AuthDivider,
  AuthHeader,
  AuthLegal,
  AuthSwitch,
  authSecondaryClass,
} from "@/components/auth/auth-header";
import { RegisterForm } from "@/components/auth/register-form";
import { GoogleButton } from "@/components/auth/google-button";
import { getCurrentUser } from "@/lib/auth";
import { isConfigured } from "@/lib/env";
import { safeRedirectPath } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign Up" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  // Where to land after sign-up (e.g. /spin to claim a pending win). Default
  // /account keeps every existing link behaving exactly as before.
  const callbackUrl = safeRedirectPath((await searchParams).callbackUrl, "/account");
  const user = await getCurrentUser();
  if (user) redirect(callbackUrl);
  const loginHref = callbackUrl === "/account" ? "/login" : `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <div className="animate-fade-up">
      <AuthHeader
        title="Create your account"
        description="Save your addresses, follow every order and check out in a few taps."
      />
      <div className="space-y-5">
        {isConfigured.google() && (
          <>
            <GoogleButton
              callbackUrl={callbackUrl === "/account" ? undefined : callbackUrl}
              className={authSecondaryClass}
            />
            <AuthDivider label="or with email" />
          </>
        )}
        <RegisterForm callbackUrl={callbackUrl} loginHref={loginHref} />
        <AuthLegal action="creating an account" />
      </div>
      <AuthSwitch prompt="Already have an account?" href={loginHref} label="Sign in" />
    </div>
  );
}
