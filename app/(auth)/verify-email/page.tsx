import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { verifyEmailToken } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token
    ? await verifyEmailToken(token)
    : { ok: false, message: "Missing verification token." };

  return (
    <Card className="max-sm:animate-fade-up max-sm:rounded-3xl max-sm:shadow-elev-2 max-sm:ring-foreground/5 max-sm:[--card-spacing:--spacing(6)]">
      <CardHeader className="items-center text-center">
        {result.ok ? (
          <CheckCircle2 className="size-12 text-primary" />
        ) : (
          <XCircle className="size-12 text-destructive" />
        )}
        <CardTitle className="text-2xl max-sm:font-heading max-sm:text-3xl max-sm:tracking-tight">
          {result.ok ? "Email verified" : "Verification failed"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">{result.message}</p>
        <Link
          href={result.ok ? "/login" : "/register"}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 max-sm:h-12 max-sm:rounded-xl max-sm:text-base max-sm:font-semibold max-sm:shadow-elev-1 max-sm:transition-transform max-sm:active:scale-[0.98]"
        >
          {result.ok ? "Continue to sign in" : "Back to sign up"}
        </Link>
      </CardContent>
    </Card>
  );
}
