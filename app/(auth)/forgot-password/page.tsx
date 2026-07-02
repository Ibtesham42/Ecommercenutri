import Link from "next/link";
import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <Card className="max-sm:animate-fade-up max-sm:rounded-3xl max-sm:shadow-elev-2 max-sm:ring-foreground/5 max-sm:[--card-spacing:--spacing(6)]">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl max-sm:font-heading max-sm:text-3xl max-sm:tracking-tight">
          Forgot password?
        </CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a reset link
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
