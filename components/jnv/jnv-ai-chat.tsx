"use client";

import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { Bot, Send, Check, CheckCheck, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { JNV_CLASS_LEVELS } from "@/lib/jnv/catalog";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: number;
  /** "sending" while queued behind another in-flight turn, "sent" once Byte
   *  has replied — mimics WhatsApp/Instagram's message-status ticks. */
  status?: "sending" | "sent";
};

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

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export type JnvAiResourceContext = { resourceId: string; title: string; classLevel: number };

/**
 * Byte — the JNV Computer Science teaching assistant chat. Entirely separate
 * component/route/persona from the storefront's `AiChat` (Nutri) — no shared
 * history, no product recommendations, own styling to match the JNV
 * blue/emerald identity. Styled and behaves like a real messaging app
 * (WhatsApp/Instagram DMs): the input is never locked, you can send several
 * questions back to back and Byte answers them in order (queued client-side,
 * one request in flight at a time so each answer has the full conversation
 * — including your other queued questions — as context).
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
  const inputRef = useRef<HTMLInputElement>(null);
  const sentInitial = useRef(false);
  const messagesRef = useRef<Msg[]>([]);
  const queueRef = useRef<{ id: string; content: string }[]>([]);
  const processingRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (initialQuestion && !sentInitial.current) {
      sentInitial.current = true;
      submit(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  function patchMessages(updater: (prev: Msg[]) => Msg[]) {
    setMessages((prev) => {
      const next = updater(prev);
      messagesRef.current = next;
      return next;
    });
  }

  /** Adds the bubble immediately (like a real chat app) and queues the actual
   *  request — never blocks typing/sending the next question. */
  function submit(text: string) {
    const content = text.trim();
    if (!content) return;

    const id = nanoid();
    patchMessages((prev) => [...prev, { id, role: "user", content, time: Date.now(), status: "sending" }]);
    setInput("");
    queueRef.current.push({ id, content });
    void processQueue();
  }

  async function processQueue() {
    if (processingRef.current) return;
    const next = queueRef.current.shift();
    if (next === undefined) return;
    processingRef.current = true;
    setStreaming(true);
    await requestReply(next.id);
    processingRef.current = false;
    if (queueRef.current.length > 0) {
      void processQueue();
    } else {
      setStreaming(false);
    }
  }

  async function requestReply(userMessageId: string) {
    // Only the conversation up to (and including) THIS turn's user message —
    // any later-queued questions haven't been "asked yet" from Byte's POV,
    // even though they're already visible as sent bubbles in the UI.
    const cutoff = messagesRef.current.findIndex((m) => m.id === userMessageId);
    const history = messagesRef.current
      .slice(0, cutoff + 1)
      .map((m) => ({ role: m.role, content: m.content }));
    const assistantId = nanoid();
    patchMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", time: Date.now() },
    ]);

    function finishUserStatus() {
      patchMessages((prev) =>
        prev.map((m) => (m.id === userMessageId ? { ...m, status: "sent" } : m)),
      );
    }

    try {
      const res = await fetch("/api/jnv/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classLevel: classLevel ? Number(classLevel) : null,
          resourceId: resourceContext?.resourceId ?? null,
          messages: history,
        }),
      });

      if (!res.ok || res.headers.get("X-AI-Fallback") === "1") {
        const raw = (await res.text()).trim();
        patchMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: raw || "Something went wrong. Please try again." }
              : msg,
          ),
        );
        finishUserStatus();
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
        patchMessages((prev) => prev.map((msg) => (msg.id === assistantId ? { ...msg, content: acc } : msg)));
      }
      if (!acc.trim()) {
        patchMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: "Sorry, I couldn't generate a response. Please try again." }
              : msg,
          ),
        );
      }
      finishUserStatus();
    } catch {
      patchMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: "Something went wrong reaching Byte. Please try again in a moment." }
            : msg,
        ),
      );
      finishUserStatus();
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

      <div
        ref={scrollRef}
        className="flex-1 space-y-1.5 overflow-y-auto bg-blue-50/30 p-4 dark:bg-slate-900/40"
        aria-live="polite"
      >
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

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const grouped = prev && prev.role === m.role;
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={cn("flex items-end gap-2", isUser && "flex-row-reverse", grouped ? "mt-0.5" : "mt-2.5")}
            >
              {!isUser && (
                <span
                  className={cn(
                    "mb-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-blue-600/10 text-blue-700 dark:text-blue-400",
                    grouped && "invisible",
                  )}
                >
                  <Bot className="size-3.5" />
                </span>
              )}
              <div className={cn("flex max-w-[78%] flex-col", isUser ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "whitespace-pre-wrap px-3.5 py-2 text-[13.5px] leading-relaxed shadow-sm",
                    isUser
                      ? "rounded-2xl rounded-br-md bg-blue-600 text-white"
                      : "rounded-2xl rounded-bl-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800",
                  )}
                >
                  {m.content || <TypingDots />}
                </div>
                {m.content && (
                  <span
                    className={cn(
                      "mt-0.5 flex items-center gap-1 px-1 text-[10px] text-slate-500 dark:text-slate-500",
                    )}
                  >
                    {formatTime(m.time)}
                    {isUser &&
                      (m.status === "sending" ? (
                        <Check className="size-3" />
                      ) : (
                        <CheckCheck className="size-3 text-blue-500" />
                      ))}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {empty && (
        <div className="flex flex-wrap gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
          {(resourceContext ? RESOURCE_SUGGESTIONS : SUGGESTIONS).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => submit(s)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {streaming && (
        <p className="border-t border-slate-200 bg-white px-4 pt-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-500">
          Byte is typing…
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
          inputRef.current?.focus();
        }}
        className={cn(
          "flex items-center gap-2 bg-white p-3 dark:bg-slate-950",
          !streaming && "border-t border-slate-200 dark:border-slate-800",
        )}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Byte…"
          autoComplete="off"
          className="h-11 flex-1 rounded-full border border-slate-200 bg-slate-100 px-4 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-900"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          aria-label="Send"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-blue-600 text-white shadow-sm transition-transform hover:bg-blue-700 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
        >
          <Send className="size-4.5" />
        </button>
      </form>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5">
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400/60 [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400/60 [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400/60" />
    </span>
  );
}
