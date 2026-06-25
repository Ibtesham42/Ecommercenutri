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
    <Card>
      <CardHeader className="items-center text-center">
        {result.ok ? (
          <CheckCircle2 className="size-12 text-primary" />
        ) : (
          <XCircle className="size-12 text-destructive" />
        )}
        <CardTitle className="text-2xl">
          {result.ok ? "Email verified" : "Verification failed"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">{result.message}</p>
        <Link
          href={result.ok ? "/login" : "/register"}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {result.ok ? "Continue to sign in" : "Back to sign up"}
        </Link>
      </CardContent>
    </Card>
  );
}
