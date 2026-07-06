import type { Metadata } from "next";
import { Leaf, ShieldCheck, HeartPulse } from "lucide-react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "About us",
  description: "The story and mission behind Nutriyet.",
  path: "/about",
});

const VALUES = [
  { icon: Leaf, title: "Clean ingredients", desc: "No artificial preservatives or additives — just the good stuff." },
  { icon: ShieldCheck, title: "Lab-tested quality", desc: "Every batch checked for purity before it reaches you." },
  { icon: HeartPulse, title: "Guided by AI", desc: "A nutrition coach in your pocket for advice that fits your life." },
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:py-20">
      {/* Lead — editorial, warm */}
      <p className="text-sm font-medium tracking-[0.16em] text-gold uppercase">Our story</p>
      <h1 className="mt-3 font-heading text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
        Clean nutrition,
        <br className="hidden sm:block" /> made joyful.
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-muted-foreground">
        Nutriyet exists to make wholesome nutrition simple and genuinely enjoyable. We curate
        premium makhana, dry fruits, seeds, protein and wellness foods — and pair them with an AI
        nutrition coach, so every choice feels effortless rather than another thing to research.
      </p>

      {/* From the heart of Mithila — the brand's roots, told as an editorial pull-quote */}
      <div className="surface-rich mt-12 overflow-hidden rounded-3xl px-7 py-9 text-surface-deep-foreground sm:px-10 sm:py-11">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-gold uppercase">From the heart of Mithila</p>
        <p className="mt-4 font-heading text-2xl leading-snug font-medium sm:text-[1.75rem]">
          Makhana has been grown in the Mithila region for generations. We bring that heritage to
          your everyday snacking — roasted, never fried, and seasoned with care.
        </p>
      </div>

      {/* Values — a single warm panel with gold thin-stroke icons + hairline
          dividers (one considered statement, not three stamped cards). */}
      <div className="mt-12 divide-y divide-border rounded-3xl border bg-card/60 shadow-elev-1 sm:divide-x sm:divide-y-0 sm:grid sm:grid-cols-3">
        {VALUES.map((v) => (
          <div key={v.title} className="p-6 sm:p-7">
            <v.icon className="size-6 text-gold" strokeWidth={1.75} aria-hidden />
            <h2 className="mt-3.5 font-heading text-lg font-semibold">{v.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{v.desc}</p>
          </div>
        ))}
      </div>

      <p className="mt-12 text-lg leading-relaxed text-muted-foreground">
        Built for everyone chasing a healthier lifestyle — one wholesome bite at a time.
      </p>
    </div>
  );
}
