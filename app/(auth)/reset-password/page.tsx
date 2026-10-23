import Link from "next/link";
import type { Metadata } from "next";
import { AuthAlert } from "@/components/auth/auth-input";
import { AuthHeader, authPrimaryClass } from "@/components/auth/auth-header";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="animate-fade-up">
      <AuthHeader
        title="Set a new password"
        description="Choose a strong password you don't use anywhere else."
      />
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-5">
          <AuthAlert kind="error">Missing or invalid reset link.</AuthAlert>
          <Link href="/forgot-password" className={cn(buttonVariants(), authPrimaryClass)}>
            Request a new link
          </Link>
        </div>
      )}
    </div>
  );
}
