"use client";

import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { Bot, Send, Loader2, User, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { JNV_CLASS_LEVELS } from "@/lib/jnv/catalog";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Explain the difference between RAM and ROM",
  "What is the binary number system? Give an example",
  "Make a 5-question MCQ quiz on Input & Output Devices",
  "Explain HTML tags with a simple example",
  "Give me a lesson plan on Networking Basics",
  "What are the do's and don'ts of Cyber Security?",
];

const RESOURCE_SUGGESTIONS = [
  "Summarize this in simple terms",
  "Generate 5 MCQs from this",
  "Create revision notes from this",
  "Create homework from this",
  "Explain this like I'm in Class 6",
];

export type JnvAiResourceContext = { resourceId: string; title: string; classLevel: number };

/**
 * Byte — the JNV Computer Science teaching assistant chat. Entirely separate
 * component/route/persona from the storefront's `AiChat` (Nutri) — no shared
 * history, no product recommendations, own styling to match the JNV
 * blue/emerald identity. When `resourceContext` is set, every turn is scoped
 * to that resource (title/description/extracted PDF text resolved
 * server-side, never sent from the client — see app/api/jnv/ai/chat/route.ts).
 */
export function JnvAiChat({
  className,
  resourceContext,
  initialQuestion,
}: {
  className?: string;
  resourceContext?: JnvAiResourceContext | null;
  initialQuestion?: string;
}) {
  const [classLevel, setClassLevel] = useState<string>(
    resourceContext ? String(resourceContext.classLevel) : "",
  );
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (initialQuestion && !sentInitial.current) {
      sentInitial.current = true;
      void send(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;

    const userMsg: Msg = { id: nanoid(), role: "user", content };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setStreaming(true);

    const assistantId = nanoid();
    setMessages((m) => [...m, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/jnv/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classLevel: classLevel ? Number(classLevel) : null,
          resourceId: resourceContext?.resourceId ?? null,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || res.headers.get("X-AI-Fallback") === "1") {
        const raw = (await res.text()).trim();
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: raw || "Something went wrong. Please try again." }
              : msg,
          ),
        );
        return;
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => m.map((msg) => (msg.id === assistantId ? { ...msg, content: acc } : msg)));
      }
      if (!acc.trim()) {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: "Sorry, I couldn't generate a response. Please try again." }
              : msg,
          ),
        );
      }
    } catch {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: "Something went wrong reaching Byte. Please try again in a moment." }
            : msg,
        ),
      );
    } finally {
      setStreaming(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <label htmlFor="jnv-ai-class" className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Class
        </label>
        <select
          id="jnv-ai-class"
          value={classLevel}
          onChange={(e) => setClassLevel(e.target.value)}
          disabled={Boolean(resourceContext)}
          className="h-8 rounded-lg border border-slate-200 bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-70 dark:border-slate-700"
        >
          <option value="">All classes</option>
          {JNV_CLASS_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              Class {lvl}
            </option>
          ))}
        </select>
        {resourceContext && (
          <span className="ml-auto flex min-w-0 items-center gap-1.5 rounded-full bg-blue-600/10 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-400">
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">{resourceContext.title}</span>
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {empty && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-blue-600/10 text-blue-700 dark:text-blue-400">
              <Bot className="size-6" />
            </span>
            <p className="mt-3 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              {resourceContext
                ? `Hi, I'm Byte. I can see "${resourceContext.title}" — ask me to summarize it, explain a part, or generate a quiz or notes from it.`
                : "Hi, I'm Byte — your Computer Science teaching assistant. Ask me to explain a topic, or generate quizzes, worksheets, lesson plans and more."}
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full",
                m.role === "user"
                  ? "bg-slate-200 dark:bg-slate-800"
                  : "bg-blue-600/10 text-blue-700 dark:text-blue-400",
              )}
            >
              {m.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
            </span>
            <div
              className={cn(
                "flex min-w-0 max-w-[80%] flex-col items-start gap-2",
                m.role === "user" && "items-end",
              )}
            >
              <div
                className={cn(
                  "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800",
                )}
              >
                {m.content || (streaming ? <TypingDots /> : "")}
              </div>
            </div>
          </div>
        ))}
      </div>

      {empty && (
        <div className="flex flex-wrap gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
          {(resourceContext ? RESOURCE_SUGGESTIONS : SUGGESTIONS).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-slate-200 p-3 dark:border-slate-800"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Byte about Computer Science…"
          className="h-10 flex-1 rounded-lg border border-slate-200 bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700"
          disabled={streaming}
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          aria-label="Send"
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
        >
          {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1">
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400/60 [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400/60 [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400/60" />
    </span>
  );
}
