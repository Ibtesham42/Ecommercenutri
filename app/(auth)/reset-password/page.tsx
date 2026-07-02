import Link from "next/link";
import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <Card className="max-sm:animate-fade-up max-sm:rounded-3xl max-sm:shadow-elev-2 max-sm:ring-foreground/5 max-sm:[--card-spacing:--spacing(6)]">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl max-sm:font-heading max-sm:text-3xl max-sm:tracking-tight">
          Set a new password
        </CardTitle>
        <CardDescription>Choose a strong password for your account</CardDescription>
      </CardHeader>
      <CardContent>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="space-y-4 text-center">
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Missing or invalid reset link.
            </p>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-primary hover:underline"
            >
              Request a new link
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
