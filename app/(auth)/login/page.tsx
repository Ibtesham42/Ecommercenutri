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
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl: rawCallback } = await searchParams;
  const callbackUrl = safeRedirectPath(rawCallback, "/account");
  const user = await getCurrentUser();
  if (user) redirect(callbackUrl);

  return (
    <AuthShell
      callbackUrl={callbackUrl}
      googleEnabled={isConfigured.google()}
      phoneEnabled={isPhoneAuthEnabled()}
    />
  );
}
