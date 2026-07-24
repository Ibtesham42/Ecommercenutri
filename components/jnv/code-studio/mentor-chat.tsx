"use client";

import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { Bot, Send, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CodeStudioLanguageId } from "@/lib/jnv/code-studio/types";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: number;
  status?: "sending" | "sent";
};

const SUGGESTIONS = [
  "Explain what my code does",
  "Why isn't this working?",
  "Give me a hint, don't just fix it",
  "How can I improve this code?",
  "What should I build next?",
];

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * The Code Studio's AI Mentor chat. Entirely session-only by design: every
 * message lives in this component's React state and nothing else — no
 * localStorage, no server-side history. Closing this panel (or the tab)
 * loses the conversation, matching the module's "your code and your
 * questions never leave your device/session" promise. Styled and behaves
 * like a real messaging app (never locks the input; sends queue and answer
 * in order), the same pattern validated for Byte in the Notes Portal.
 */
export function MentorChat({
  language,
  getCode,
  getConsoleOutput,
  className,
}: {
  language: CodeStudioLanguageId;
  /** Pulled fresh at send-time (not on every keystroke) so the mentor always
   *  sees the student's latest code without re-rendering this chat on every edit. */
  getCode: () => string;
  getConsoleOutput: () => string;
  className?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<Msg[]>([]);
  const queueRef = useRef<{ id: string; content: string }[]>([]);
  const processingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function patchMessages(updater: (prev: Msg[]) => Msg[]) {
    setMessages((prev) => {
      const next = updater(prev);
      messagesRef.current = next;
      return next;
    });
  }

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
    const cutoff = messagesRef.current.findIndex((m) => m.id === userMessageId);
    const history = messagesRef.current.slice(0, cutoff + 1).map((m) => ({ role: m.role, content: m.content }));
    const assistantId = nanoid();
    patchMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", time: Date.now() }]);

    function finishUserStatus() {
      patchMessages((prev) => prev.map((m) => (m.id === userMessageId ? { ...m, status: "sent" } : m)));
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/jnv/code-studio/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          code: getCode(),
          consoleOutput: getConsoleOutput(),
          messages: history,
        }),
        signal: controller.signal,
      });

      if (!res.ok || res.headers.get("X-AI-Fallback") === "1") {
        const raw = (await res.text()).trim();
        patchMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: raw || "Something went wrong. Please try again." } : m)),
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
        patchMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)));
      }
      if (!acc.trim()) {
        patchMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: "Sorry, I couldn't generate a response. Please try again." } : m)),
        );
      }
      finishUserStatus();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      patchMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: "Something went wrong reaching the mentor. Please try again in a moment." } : m,
        ),
      );
      finishUserStatus();
    }
  }

  const empty = messages.length === 0;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div
        ref={scrollRef}
        className="flex-1 space-y-1.5 overflow-y-auto bg-indigo-50/30 p-4 dark:bg-slate-900/40"
        aria-live="polite"
      >
        {empty && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-indigo-600/10 text-indigo-700 dark:text-indigo-400">
              <Bot className="size-6" />
            </span>
            <p className="mt-3 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Hi, I&apos;m your Code Mentor. Ask me to explain your code, find a bug, or suggest what to build
              next — I can see what&apos;s in your editor right now, but I never save our chat anywhere.
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
                    "mb-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-indigo-600/10 text-indigo-700 dark:text-indigo-400",
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
                      ? "rounded-2xl rounded-br-md bg-indigo-600 text-white"
                      : "rounded-2xl rounded-bl-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800",
                  )}
                >
                  {m.content || <TypingDots />}
                </div>
                {m.content && (
                  <span className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-slate-500 dark:text-slate-500">
                    {formatTime(m.time)}
                    {isUser &&
                      (m.status === "sending" ? (
                        <Check className="size-3" />
                      ) : (
                        <CheckCheck className="size-3 text-indigo-500" />
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
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => submit(s)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {streaming && (
        <p className="border-t border-slate-200 bg-white px-4 pt-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-500">
          Mentor is typing…
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
          placeholder="Ask about your code…"
          autoComplete="off"
          className="h-11 flex-1 rounded-full border border-slate-200 bg-slate-100 px-4 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-900"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          aria-label="Send"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-indigo-600 text-white shadow-sm transition-transform hover:bg-indigo-700 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
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
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400/60 motion-reduce:animate-none [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400/60 motion-reduce:animate-none [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400/60 motion-reduce:animate-none" />
    </span>
  );
}
