"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Lock,
  Check,
  Gift,
  User,
  Mail,
  MessageCircleHeart,
  Timer,
  FileHeart,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthInput, AuthAlert } from "@/components/auth/auth-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { GoogleButton } from "@/components/auth/google-button";
import { PasswordField } from "@/components/auth/password-field";
import { ScoreGauge } from "@/components/storefront/quiz/score-gauge";
import { trackClient } from "@/components/storefront/behavior-tracker";
import { cn } from "@/lib/utils";
import { QUIZ_QUESTIONS, type QuizAnswers, type QuizKey } from "@/lib/quiz/questions";
import { completeQuiz, quizSignup, type CompleteQuizResult, type QuizSignupState } from "@/lib/actions/quiz";

type Phase = "intro" | "quiz" | "analyzing" | "result";
type Success = Extract<CompleteQuizResult, { ok: true }>;

/** Warm coach lead-ins, one per question — presentation only, catalog untouched. */
const COACH_LINES = [
  "Let's start with what matters most to you.",
  "Lovely — that helps us tune everything to you.",
  "Now, a little about your routine.",
  "Halfway there — you're doing great.",
  "Almost done — let's talk taste.",
  "Last one — this rounds out your profile.",
];

const OPTION_DELAYS = ["fade-delay-1", "fade-delay-2", "fade-delay-3", "fade-delay-4", "fade-delay-5"];

export function HealthQuiz({
  isLoggedIn,
  couponPercent,
}: {
  isLoggedIn: boolean;
  couponPercent: number;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  const [result, setResult] = useState<Success | null>(null);
  const [error, setError] = useState<string | null>(null);

  const question = QUIZ_QUESTIONS[step];
  const total = QUIZ_QUESTIONS.length;

  function start() {
    trackClient({ type: "QUIZ_START", path: "/quiz" });
    setPhase("quiz");
  }

  function choose(key: QuizKey, value: string) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (step < total - 1) {
      window.setTimeout(() => setStep((s) => s + 1), 240);
    } else {
      void analyze(next as QuizAnswers);
    }
  }

  async function analyze(finalAnswers: QuizAnswers) {
    setPhase("analyzing");
    setError(null);
    const [res] = await Promise.all([
      completeQuiz(finalAnswers),
      new Promise((r) => setTimeout(r, 1500)), // let all three "analyzing" beats land
    ]);
    if (res.ok) {
      setResult(res);
      setPhase("result");
    } else {
      setError(res.error);
      setPhase("result");
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      {phase === "intro" && <Intro onStart={start} couponPercent={couponPercent} />}

      {phase === "quiz" && question && (
        <div>
          <ProgressBar step={step} total={total} />
          <div key={step} className="animate-fade-up mt-6">
            <p className="text-sm font-medium text-primary">{COACH_LINES[step] ?? "You're almost there."}</p>
            <h2 className="mt-1.5 font-heading text-2xl font-semibold sm:text-3xl">{question.question}</h2>
            {question.help && <p className="mt-1.5 text-sm text-muted-foreground">{question.help}</p>}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {question.options.map((o, i) => {
                const selected = answers[question.id] === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => choose(question.id, o.value)}
                    aria-pressed={selected}
                    className={cn(
                      "group animate-fade-up flex items-center gap-3 rounded-2xl border bg-card p-3.5 text-left shadow-elev-1 transition-all duration-150 hover:border-primary/50 hover:shadow-elev-2 motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]",
                      OPTION_DELAYS[Math.min(i, OPTION_DELAYS.length - 1)],
                      selected && "border-primary bg-primary/5 ring-2 ring-primary/30",
                    )}
                  >
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-xl transition-colors group-hover:bg-primary/10"
                      aria-hidden
                    >
                      {o.emoji}
                    </span>
                    <span className="flex-1 font-medium">{o.label}</span>
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
                        selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-transparent",
                      )}
                    >
                      <Check className={cn("size-3.5", selected && "animate-pop")} />
                    </span>
                  </button>
                );
              })}
            </div>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="mt-6 inline-flex items-center gap-1.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-4" /> Back
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "analyzing" && <Analyzing />}

      {phase === "result" &&
        (error ? (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-elev-1">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button className="mt-4" onClick={() => { setPhase("intro"); setStep(0); setAnswers({}); }}>
              Try again
            </Button>
          </div>
        ) : result ? (
          <QuizResult result={result} isLoggedIn={isLoggedIn} couponPercent={couponPercent} />
        ) : null)}
    </div>
  );
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = ((step + 1) / total) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>Question {step + 1} of {total}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Intro({ onStart, couponPercent }: { onStart: () => void; couponPercent: number }) {
  const expectations = [
    {
      icon: MessageCircleHeart,
      title: "Tell us about you",
      desc: "6 friendly questions — no wrong answers, no typing",
    },
    {
      icon: Timer,
      title: "Takes under a minute",
      desc: "Just tap the answer that feels most like you",
    },
    {
      icon: FileHeart,
      title: "Get your personal profile",
      desc: `Your health score, snack matches + a ${couponPercent}% welcome reward`,
    },
  ];

  return (
    <div className="animate-fade-up text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold-foreground">
        <Sparkles className="size-3.5 text-gold" /> Free · Under a minute
      </span>
      <h1 className="mt-4 font-heading text-3xl font-bold sm:text-4xl">Let&apos;s find your healthy snacking profile</h1>
      <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted-foreground">
        Answer 6 quick questions about your lifestyle — our AI turns them into your personal
        Nutriyet Health Score and a snack plan made just for you.
      </p>
      <ul className="mx-auto mt-7 flex max-w-sm flex-col gap-2.5 text-left">
        {expectations.map((e, i) => (
          <li
            key={e.title}
            className={cn(
              "animate-fade-up hover-lift flex items-start gap-3 rounded-2xl bg-secondary/60 px-4 py-3.5 shadow-elev-1 dark:bg-secondary/40",
              OPTION_DELAYS[i],
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <e.icon className="size-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{e.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{e.desc}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="animate-fade-up fade-delay-4">
        <Button size="lg" onClick={onStart} className="btn-rich mt-7 h-13 gap-2 px-8 text-base font-semibold shadow-elev-2">
          Start My Free Assessment <ArrowRight className="size-5" />
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">Free · your answers stay private</p>
      </div>
    </div>
  );
}

function Analyzing() {
  const beats = [
    "Understanding your lifestyle",
    "Matching snacks to your goal",
    "Writing your personal tips",
  ];
  return (
    <div className="animate-fade-up grid place-items-center py-16 text-center">
      <span className="pulse-halo grid size-16 place-items-center rounded-full bg-primary/10">
        <Sparkles className="size-7 text-primary" />
      </span>
      <p className="mt-6 font-heading text-xl font-semibold">Reading your answers…</p>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        {beats.map((b, i) => (
          <li
            key={b}
            className="animate-fade-up flex items-center justify-center gap-2"
            style={{ animationDelay: `${200 + i * 450}ms` }}
          >
            <Check className="size-3.5 text-primary" /> {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuizResult({
  result,
  isLoggedIn,
  couponPercent,
}: {
  result: Success;
  isLoggedIn: boolean;
  couponPercent: number;
}) {
  return (
    <div className="animate-fade-up">
      <div className="rounded-3xl border bg-card p-6 text-center shadow-elev-2 sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold-foreground">
          <Sparkles className="size-3.5 text-gold" /> Your result is ready
        </span>
        <div className="mt-5 grid place-items-center">
          <ScoreGauge score={result.score} band={result.band} />
        </div>
        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">{result.summary}</p>

        {result.teaserTips[0] && (
          <div className="mx-auto mt-5 flex max-w-md items-start gap-3 rounded-2xl border bg-accent/40 p-4 text-left text-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold/15">
              <Lightbulb className="size-4.5 text-gold" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">Your first tip</p>
              <p className="mt-1 text-muted-foreground">{result.teaserTips[0]}</p>
            </div>
          </div>
        )}
      </div>

      {isLoggedIn ? (
        <div className="mt-5 rounded-3xl border bg-card p-6 text-center shadow-elev-1">
          <Check className="mx-auto size-8 text-primary" />
          <p className="mt-2 font-semibold">Report saved to your account</p>
          <p className="mt-1 text-sm text-muted-foreground">
            View your full plan, all {result.totalTips} tips and your welcome coupon in your dashboard.
          </p>
          <Button asChild className="btn-rich mt-4">
            <Link href="/account?welcome=1">View my health report</Link>
          </Button>
        </div>
      ) : (
        <UnlockSignup result={result} couponPercent={couponPercent} />
      )}
    </div>
  );
}

function UnlockSignup({ result, couponPercent }: { result: Success; couponPercent: number }) {
  const [state, action] = useActionState<QuizSignupState, FormData>(quizSignup, undefined);

  const perks = [
    { icon: Gift, text: `${couponPercent}% welcome coupon` },
    { icon: Check, text: `All ${result.totalTips} personalized tips + ${result.focusCount} snack picks` },
    { icon: Check, text: "Saved to your account forever" },
  ];

  return (
    <div className="mt-5 overflow-hidden rounded-3xl border bg-card shadow-elev-2">
      <div className="surface-rich px-6 py-5 text-surface-deep-foreground">
        <p className="flex items-center gap-2 font-heading text-lg font-semibold">
          <Lock className="size-4 text-gold" /> Unlock your full report
        </p>
        <ul className="mt-3 space-y-2 text-sm text-surface-deep-foreground/85">
          {perks.map((p) => (
            <li key={p.text} className="flex items-center gap-2.5">
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-white/10">
                <p.icon className="size-3.5 text-gold" />
              </span>
              {p.text}
            </li>
          ))}
        </ul>
      </div>

      <form action={action} className="space-y-4 p-6">
        <input type="hidden" name="resultId" value={result.id} />
        {state?.error && <AuthAlert kind="error">{state.error}</AuthAlert>}
        <div className="space-y-2">
          <Label htmlFor="q-name">Full name</Label>
          <AuthInput id="q-name" name="name" icon={User} autoComplete="name" placeholder="Jane Doe" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="q-email">Email</Label>
          <AuthInput id="q-email" name="email" type="email" icon={Mail} autoComplete="email" placeholder="you@example.com" required />
        </div>
        <PasswordField id="q-password" name="password" label="Create a password" autoComplete="new-password" placeholder="At least 8 characters" />
        <SubmitButton className="btn-rich h-12 w-full text-base font-semibold shadow-elev-1">
          Create account &amp; unlock report
        </SubmitButton>
        <div className="relative py-1 text-center">
          <span className="relative z-10 bg-card px-3 text-xs text-muted-foreground">or</span>
          <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        </div>
        <GoogleButton callbackUrl="/account?welcome=1" />
        <p className="text-center text-xs text-muted-foreground">
          Already a member?{" "}
          <Link href="/login?callbackUrl=/account" className="font-medium text-primary hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
