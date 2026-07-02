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
import { RegisterForm } from "@/components/auth/register-form";
import { GoogleButton } from "@/components/auth/google-button";
import { getCurrentUser } from "@/lib/auth";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/account");

  return (
    <Card className="max-sm:animate-fade-up max-sm:rounded-3xl max-sm:shadow-elev-2 max-sm:ring-foreground/5 max-sm:[--card-spacing:--spacing(6)]">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl max-sm:font-heading max-sm:text-3xl max-sm:tracking-tight">
          Create your account
        </CardTitle>
        {/* Desktop copy unchanged; mobile gets the warmer brand greeting. */}
        <CardDescription className="max-sm:hidden">
          Join Nutriyet and eat clean, live strong
        </CardDescription>
        <CardDescription className="sm:hidden">Healthy snacking starts here 🌿</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConfigured.google() && (
          <>
            <GoogleButton />
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
        <RegisterForm />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Already have an account?&nbsp;
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
