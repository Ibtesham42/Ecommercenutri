import type { Metadata } from "next";
import { Leaf, ShieldCheck, HeartPulse } from "lucide-react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "About us",
  description: "The story and mission behind Nutriyet.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">About Nutriyet</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Nutriyet exists to make clean, wholesome nutrition simple and joyful. We
        curate premium makhana, dry fruits, seeds, protein and wellness
        products — and pair them with an AI nutrition expert so every choice
        feels effortless.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {[
          { icon: Leaf, title: "Clean ingredients", desc: "No artificial preservatives or additives." },
          { icon: ShieldCheck, title: "Lab-tested quality", desc: "Every batch checked for purity." },
          { icon: HeartPulse, title: "Guided by AI", desc: "Personalized, science-backed advice." },
        ].map((v) => (
          <div key={v.title} className="rounded-xl border p-5">
            <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <v.icon className="size-6" />
            </span>
            <h2 className="mt-3 font-semibold">{v.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{v.desc}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 text-muted-foreground">
        Built for everyone chasing a healthier lifestyle — one wholesome bite at
        a time.
      </p>
    </div>
  );
}
