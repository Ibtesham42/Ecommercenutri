import { BellRing } from "lucide-react";

/** Shown on the Marketing Hub overview until VAPID keys are configured. */
export function PushSetupCard() {
  return (
    <section className="mt-6 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-dashed bg-accent/30 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <BellRing className="size-5" />
        </span>
        <div className="space-y-1.5">
          <h2 className="font-semibold">Enable push notifications (free)</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Web Push needs a one-time VAPID keypair — no account or paid service. Generate keys,
            add them to your environment and redeploy; the Push channel then goes live everywhere.
          </p>
          <code className="block w-fit rounded-md bg-muted px-2 py-1 text-xs">
            npx web-push generate-vapid-keys
          </code>
          <p className="text-xs text-muted-foreground">
            Set <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>, <code>VAPID_PRIVATE_KEY</code> and
            optionally <code>VAPID_SUBJECT</code> in <code>.env</code> (local) and the Vercel
            environment variables (then redeploy — the public key is baked in at build time).
            Full guide: <code>PUSH_NOTIFICATIONS.md</code> in the repo root.
          </p>
        </div>
      </div>
    </section>
  );
}
