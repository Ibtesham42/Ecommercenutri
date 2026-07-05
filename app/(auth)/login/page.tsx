import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { GoogleButton } from "@/components/auth/google-button";
import { getCurrentUser } from "@/lib/auth";
import { isConfigured } from "@/lib/env";
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
    <Card className="max-sm:animate-fade-up max-sm:rounded-3xl max-sm:shadow-elev-2 max-sm:ring-foreground/5 max-sm:[--card-spacing:--spacing(6)]">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl max-sm:font-heading max-sm:text-3xl max-sm:tracking-tight">
          Welcome back
        </CardTitle>
        {/* Desktop copy unchanged; mobile gets the warmer brand greeting. */}
        <CardDescription className="max-sm:hidden">Sign in to your Nutriyet account</CardDescription>
        <CardDescription className="sm:hidden">
          Sign in to continue your healthy journey 🌿
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConfigured.google() && (
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
        <LoginForm callbackUrl={callbackUrl || "/account"} />
      </CardContent>
      <CardFooter className="justify-center gap-1.5 text-sm text-muted-foreground">
        <span>Don&apos;t have an account?</span>
        <Link
          href="/register"
          className="rounded-md px-1.5 py-0.5 text-base font-semibold text-gold underline-offset-4 transition hover:bg-gold/10 hover:underline focus-visible:bg-gold/10 active:scale-[0.97]"
        >
          Sign Up
        </Link>
      </CardFooter>
    </Card>
  );
}
