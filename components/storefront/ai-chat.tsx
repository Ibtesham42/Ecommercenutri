"use client";

import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { Sparkles, Send, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Msg = { id: string; role: "user" | "assistant"; content: string };

export function AiChat({
  productId,
  greeting,
  suggestions = [],
  initialQuestion,
  className,
  heightClass = "h-[60vh]",
  variant = "inline",
}: {
  productId?: string;
  greeting?: string;
  suggestions?: string[];
  initialQuestion?: string;
  className?: string;
  heightClass?: string;
  /** "page" = the /assistant page: enables the mobile-app treatment (which is
   *  entirely `max-sm:`-gated, so desktop and the inline product assistant are
   *  pixel-identical to before). */
  variant?: "page" | "inline";
}) {
  const page = variant === "page";
  const [sessionId] = useState(() => nanoid());
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          productId: productId ?? null,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      // Friendly fallbacks (disabled / rate-limited) come back as plain text;
      // render their message inline instead of a generic error.
      if (!res.ok || res.headers.get("X-AI-Fallback") === "1") {
        const text = (await res.text()).trim();
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: text || "Something went wrong. Please try again." }
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
        setMessages((m) =>
          m.map((msg) => (msg.id === assistantId ? { ...msg, content: acc } : msg)),
        );
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
            ? {
                ...msg,
                content:
                  "Something went wrong reaching the assistant. Please try again in a moment.",
              }
            : msg,
        ),
      );
    } finally {
      setStreaming(false);
    }
  }

  // Auto-send a deep-linked question (e.g. from "Ask AI about this product").
  useEffect(() => {
    if (initialQuestion && !sentInitial.current) {
      sentInitial.current = true;
      void send(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  const empty = messages.length === 0;

  return (
    <div className={cn("flex flex-col rounded-2xl border bg-background", className)}>
      <div
        ref={scrollRef}
        className={cn(
          "flex-1 space-y-4 overflow-y-auto p-4",
          page && "max-sm:space-y-3.5 max-sm:overscroll-contain max-sm:p-3.5",
          heightClass,
        )}
        aria-live="polite"
      >
        {empty && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </span>
            <p
              className={cn(
                "mt-3 max-w-sm text-sm text-muted-foreground",
                page && "max-sm:text-[15px] max-sm:leading-relaxed",
              )}
            >
              {greeting ?? "Ask me anything about nutrition or our products."}
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex gap-3",
              m.role === "user" && "flex-row-reverse",
              page && "max-sm:animate-fade-up max-sm:gap-2",
            )}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full",
                m.role === "user" ? "bg-secondary" : "bg-primary/10 text-primary",
                // The user's own avatar adds little on a narrow screen — give
                // the text room instead (WhatsApp-style).
                page && m.role === "user" && "max-sm:hidden",
              )}
            >
              {m.role === "user" ? <User className="size-4" /> : <Sparkles className="size-4" />}
            </span>
            <div
              className={cn(
                "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
                page &&
                  "max-sm:max-w-[86%] max-sm:break-words max-sm:px-3.5 max-sm:py-2.5 max-sm:text-[15px] max-sm:leading-relaxed max-sm:shadow-elev-1",
                // Chat-app bubble tails on mobile.
                page && (m.role === "user" ? "max-sm:rounded-br-md" : "max-sm:rounded-bl-md"),
              )}
            >
              {m.content || (streaming ? <TypingDots /> : "")}
            </div>
          </div>
        ))}
      </div>

      {empty && suggestions.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap gap-2 border-t p-3",
            // Mobile: one swipeable row of larger, thumb-sized chips (the
            // horizontal scroll is contained here — the page never scrolls
            // sideways).
            page &&
              "max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[-webkit-overflow-scrolling:touch] max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden",
          )}
        >
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className={cn(
                "rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary",
                page &&
                  "max-sm:shrink-0 max-sm:bg-accent/40 max-sm:px-4 max-sm:py-2.5 max-sm:text-sm max-sm:transition-transform max-sm:active:scale-95",
              )}
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
        className={cn("flex items-center gap-2 border-t p-3", page && "max-sm:gap-2.5")}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about nutrition or products…"
          className={cn(
            "h-10 flex-1 rounded-lg border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30",
            // Mobile: 48px pill; text-base (16px) stops iOS zooming on focus.
            page &&
              "max-sm:h-12 max-sm:min-w-0 max-sm:rounded-full max-sm:bg-background max-sm:px-4 max-sm:text-base",
          )}
          disabled={streaming}
        />
        <Button
          type="submit"
          size="icon"
          disabled={streaming || !input.trim()}
          aria-label="Send"
          className={cn(
            page &&
              "max-sm:size-12 max-sm:rounded-full max-sm:shadow-elev-1 max-sm:transition-transform max-sm:active:scale-95 max-sm:[&_svg]:size-5",
          )}
        >
          {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1">
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50" />
    </span>
  );
}
