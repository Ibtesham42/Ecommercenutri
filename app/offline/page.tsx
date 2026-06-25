import Link from "next/link";
import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
        <WifiOff className="size-8" />
      </span>
      <h1 className="mt-5 text-2xl font-bold">You&apos;re offline</h1>
      <p className="mt-2 text-muted-foreground">
        It looks like you&apos;ve lost your connection. Check your network and try
        again — your cart is saved on this device.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Retry
      </Link>
    </div>
  );
}
