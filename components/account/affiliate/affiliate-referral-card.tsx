"use client";

import { useState } from "react";
import { Copy, Check, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ShareButtons } from "@/components/storefront/share-buttons";

export function AffiliateReferralCard({
  referralUrl,
  couponCode,
}: {
  referralUrl: string;
  couponCode: string | null;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, what: string) {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(what);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(null), 1500);
      })
      .catch(() => toast.error("Couldn't copy"));
  }

  function printQr() {
    const w = window.open("", "_blank", "width=420,height=560");
    if (!w) return;
    w.document.write(
      `<title>Referral QR</title><div style="font-family:sans-serif;text-align:center;padding:24px"><img src="/api/affiliate/qr" style="width:320px;height:320px" onload="window.print()" /><p style="word-break:break-all">${referralUrl}</p></div>`,
    );
    w.document.close();
  }

  return (
    <div className="grid gap-5 rounded-2xl border p-5 sm:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Your referral link</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={referralUrl}
              className="h-9 w-full rounded-md border bg-muted/40 px-3 text-sm"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => copy(referralUrl, "link")}
            >
              {copied === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}
              Copy
            </Button>
          </div>
        </div>

        {couponCode && (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">Your coupon code</p>
            <div className="flex gap-2">
              <span className="inline-flex h-9 items-center rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 font-mono text-sm font-semibold tracking-wider text-primary">
                {couponCode}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => copy(couponCode, "coupon")}
              >
                {copied === "coupon" ? <Check className="size-4" /> : <Copy className="size-4" />}
                Copy
              </Button>
            </div>
          </div>
        )}

        {/* Explicit one-tap channels — WhatsApp-first (dominant in India) with a
            ready-to-send referral message; works on desktop too, unlike the
            mobile-only native share sheet. */}
        <ShareButtons
          url={referralUrl}
          title="Shop healthy with Nutriyet — premium makhana & superfoods. Use my link:"
        />
      </div>

      {/* QR */}
      <div className="flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/affiliate/qr"
          alt="Referral QR code"
          width={160}
          height={160}
          className="size-40 rounded-xl border bg-white p-2"
        />
        <div className="flex gap-1.5">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a href="/api/affiliate/qr?download=1" download>
              <Download className="size-4" /> Save
            </a>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={printQr}>
            <Printer className="size-4" /> Print
          </Button>
        </div>
      </div>
    </div>
  );
}
