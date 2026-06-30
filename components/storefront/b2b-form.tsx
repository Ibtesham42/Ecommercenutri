"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitB2BInquiry } from "@/lib/actions/b2b";
import { b2bInquirySchema, type B2BInquiryInput } from "@/lib/validations/b2b";
import { BUSINESS_TYPES, B2B_PURPOSES } from "@/lib/b2b";

const selectClass =
  "h-10 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

export function B2BForm() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<B2BInquiryInput>({
    resolver: zodResolver(b2bInquirySchema),
    defaultValues: {
      fullName: "",
      companyName: "",
      businessType: undefined,
      phone: "",
      email: "",
      city: "",
      state: "",
      country: "India",
      purpose: undefined,
      message: "",
      website: "",
    },
  });

  async function onSubmit(values: B2BInquiryInput) {
    setSending(true);
    const res = await submitB2BInquiry(values);
    setSending(false);
    if (res.ok) {
      setSent(true);
      reset();
    } else {
      toast.error(res.error);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-accent/30 p-8 text-center shadow-elev-1">
        <span className="grid size-16 place-items-center rounded-full bg-primary/10 ring-8 ring-primary/5">
          <CheckCircle2 className="size-9 text-primary" />
        </span>
        <h3 className="mt-1 font-heading text-xl font-semibold">Inquiry received</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Thank you for contacting Nutriyet Business. We have successfully received your
          inquiry. Our business team will review your request and contact you within
          24&nbsp;hours.
        </p>
        <Button variant="outline" className="mt-2" onClick={() => setSent(false)}>
          Submit another inquiry
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-2xl border bg-card p-5 shadow-elev-1 sm:p-6"
    >
      {/* Honeypot — visually hidden, off-screen, not focusable. */}
      <div className="absolute left-[-9999px]" aria-hidden>
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" {...register("website")} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={errors.fullName?.message}>
          <Input autoComplete="name" {...register("fullName")} />
        </Field>
        <Field label="Company name" error={errors.companyName?.message}>
          <Input autoComplete="organization" {...register("companyName")} />
        </Field>
        <Field label="Business type" required error={errors.businessType?.message}>
          <select className={selectClass} defaultValue="" {...register("businessType")}>
            <option value="" disabled>
              Select business type
            </option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Purpose of contact" required error={errors.purpose?.message}>
          <select className={selectClass} defaultValue="" {...register("purpose")}>
            <option value="" disabled>
              Select a purpose
            </option>
            {B2B_PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mobile number" required error={errors.phone?.message}>
          <Input type="tel" autoComplete="tel" placeholder="+91 …" {...register("phone")} />
        </Field>
        <Field label="Email address" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="City" error={errors.city?.message}>
          <Input autoComplete="address-level2" {...register("city")} />
        </Field>
        <Field label="State" error={errors.state?.message}>
          <Input autoComplete="address-level1" {...register("state")} />
        </Field>
        <Field label="Country" error={errors.country?.message}>
          <Input autoComplete="country-name" {...register("country")} />
        </Field>
      </div>

      <Field label="Message" required error={errors.message?.message}>
        <Textarea
          rows={5}
          placeholder="Tell us about your requirement — products, quantities, timeline…"
          {...register("message")}
        />
      </Field>

      <Button type="submit" size="lg" disabled={sending} className="w-full gap-2 sm:w-auto">
        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Send Business Inquiry
      </Button>
    </form>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
