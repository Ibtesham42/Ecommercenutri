"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SURVEY_SECTIONS, type SurveyQuestion } from "@/lib/survey";
import { submitSurveyResponse } from "@/lib/actions/survey";
import { cn } from "@/lib/utils";

const DONE_KEY = "nut_survey_done";

/** Bilingual question title. */
function QTitle({ q }: { q: SurveyQuestion }) {
  return (
    <div className="mb-3">
      <p className="text-sm font-semibold leading-snug">
        {q.num}. {q.en}
        {q.required && <span className="ml-0.5 text-destructive">*</span>}
      </p>
      <p className="text-sm text-muted-foreground">{q.hi}</p>
    </div>
  );
}

export function SurveyForm() {
  const [singles, setSingles] = useState<Record<string, string>>({});
  const [multis, setMultis] = useState<Record<string, string[]>>({});
  const [others, setOthers] = useState<Record<string, string>>({});
  const [city, setCity] = useState("");
  const [contact, setContact] = useState({ name: "", mobile: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      if (localStorage.getItem(DONE_KEY)) setAlreadyDone(true);
    } catch {}
  }, []);

  const toggleMulti = (id: string, key: string) =>
    setMultis((m) => {
      const cur = m[id] ?? [];
      return { ...m, [id]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] };
    });

  function submit() {
    // Required singles must be answered before the server sees anything.
    const unanswered = SURVEY_SECTIONS.flatMap((s) => s.questions).filter(
      (q) => q.required && q.type === "single" && !singles[q.id],
    );
    if (unanswered.length > 0) {
      setMissing(unanswered.map((q) => q.id));
      setError("Please answer the marked questions. | कृपया चिह्नित प्रश्नों के उत्तर दें।");
      document
        .getElementById(`q-${unanswered[0].id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setMissing([]);
    setError(null);

    startTransition(async () => {
      const res = await submitSurveyResponse({
        ...singles,
        snacks: multis.snacks ?? [],
        makhanaForms: multis.makhanaForms ?? [],
        makhanaBarriers: multis.makhanaBarriers ?? [],
        buyPlaces: multis.buyPlaces ?? [],
        flavours: multis.flavours ?? [],
        topics: multis.topics ?? [],
        occupationOther: others.occupationOther ?? "",
        snacksOther: others.snacksOther ?? "",
        makhanaBarrierOther: others.makhanaBarrierOther ?? "",
        flavourOther: others.flavourOther ?? "",
        city,
        contactName: contact.name,
        contactMobile: contact.mobile,
        contactEmail: contact.email,
      });
      if (res.ok) {
        try {
          localStorage.setItem(DONE_KEY, new Date().toISOString());
        } catch {}
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setError(res.error);
      }
    });
  }

  if (submitted) {
    return (
      <div className="animate-fade-up rounded-2xl border bg-card p-8 text-center shadow-elev-2">
        <CheckCircle2 className="mx-auto size-12 text-primary" />
        <h2 className="mt-4 font-heading text-2xl font-semibold">Thank You | धन्यवाद</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Your feedback helps us promote healthier food choices, nutrition awareness, and
          traditional Indian foods.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          आपकी प्रतिक्रिया स्वस्थ भोजन, पोषण जागरूकता और पारंपरिक भारतीय खाद्य संस्कृति को
          बढ़ावा देने में हमारी सहायता करती है।
        </p>
        <p className="mt-5 text-sm font-medium text-primary">
          Powered by NutriYet – Nutrient. And Beyond!
        </p>
      </div>
    );
  }

  if (alreadyDone) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center shadow-elev-1">
        <CheckCircle2 className="mx-auto size-10 text-primary" />
        <h2 className="mt-3 font-heading text-xl font-semibold">
          You have already completed this survey. | आप यह सर्वेक्षण पहले ही भर चुके हैं।
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Thank you for your response! | आपके उत्तर के लिए धन्यवाद!
        </p>
        <Button variant="outline" className="mt-5" onClick={() => setAlreadyDone(false)}>
          Fill again | दोबारा भरें
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {SURVEY_SECTIONS.map((section) => (
        <section
          key={section.key}
          className="rounded-2xl border bg-card p-5 shadow-elev-1 sm:p-6"
        >
          <h2 className="font-heading text-base font-semibold text-primary">
            {section.en} <span className="text-muted-foreground">| {section.hi}</span>
          </h2>
          <div className="mt-4 space-y-6">
            {section.questions.map((q) => (
              <div key={q.id} id={`q-${q.id}`}>
                <QTitle q={q} />
                {missing.includes(q.id) && (
                  <p className="mb-2 text-xs font-medium text-destructive">
                    Please select an answer | कृपया एक उत्तर चुनें
                  </p>
                )}

                {q.type === "text" && (
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={120}
                    placeholder="e.g. Patna | जैसे पटना"
                    className="max-w-sm"
                  />
                )}

                {q.type !== "text" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(q.options ?? []).map((opt) => {
                      const checked =
                        q.type === "single"
                          ? singles[q.id] === opt.key
                          : (multis[q.id] ?? []).includes(opt.key);
                      return (
                        <label
                          key={opt.key}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition",
                            checked
                              ? "border-primary bg-accent/60"
                              : "hover:border-primary/40 hover:bg-accent/30",
                          )}
                        >
                          <input
                            type={q.type === "single" ? "radio" : "checkbox"}
                            name={q.id}
                            value={opt.key}
                            checked={checked}
                            onChange={() =>
                              q.type === "single"
                                ? setSingles((s) => ({ ...s, [q.id]: opt.key }))
                                : toggleMulti(q.id, opt.key)
                            }
                            className="size-4 shrink-0 accent-primary"
                          />
                          <span>
                            {opt.en}
                            {opt.hi && (
                              <span className="text-muted-foreground"> | {opt.hi}</span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* "Other …" free text when the Other option is selected. */}
                {q.otherField &&
                  (q.type === "single"
                    ? singles[q.id] === "other"
                    : (multis[q.id] ?? []).includes("other")) && (
                    <Input
                      value={others[q.otherField] ?? ""}
                      onChange={(e) =>
                        setOthers((o) => ({ ...o, [q.otherField!]: e.target.value }))
                      }
                      maxLength={120}
                      placeholder="Please specify | कृपया लिखें"
                      className="mt-2 max-w-sm"
                    />
                  )}

                {/* Optional contact details when opting into updates (Q17). */}
                {q.id === "wantsUpdates" && singles.wantsUpdates === "yes" && (
                  <div className="mt-4 space-y-3 rounded-xl border bg-accent/30 p-4">
                    <p className="text-xs text-muted-foreground">
                      If yes (optional) | यदि हाँ (वैकल्पिक)
                    </p>
                    <Input
                      value={contact.name}
                      onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                      maxLength={80}
                      placeholder="Name | नाम"
                    />
                    <Input
                      value={contact.mobile}
                      onChange={(e) => setContact((c) => ({ ...c, mobile: e.target.value }))}
                      maxLength={16}
                      inputMode="tel"
                      placeholder="Mobile | मोबाइल"
                    />
                    <Input
                      value={contact.email}
                      onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                      maxLength={120}
                      inputMode="email"
                      placeholder="Email | ईमेल"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        onClick={submit}
        disabled={pending}
        className="h-12 w-full text-base font-semibold shadow-elev-1"
      >
        {pending ? "Submitting… | भेजा जा रहा है…" : "Submit | जमा करें"}
      </Button>
    </div>
  );
}
