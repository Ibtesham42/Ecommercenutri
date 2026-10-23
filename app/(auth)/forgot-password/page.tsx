import type { Metadata } from "next";
import { AuthHeader, AuthSwitch } from "@/components/auth/auth-header";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="animate-fade-up">
      <AuthHeader
        title="Reset your password"
        description="Enter the email on your account and we'll send you a link to choose a new password."
      />
      <ForgotPasswordForm />
      <AuthSwitch prompt="Remembered it?" href="/login" label="Back to sign in" />
    </div>
  );
}
