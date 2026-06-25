import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Sparkles, User } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getUserChat } from "@/lib/ai/history";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "AI conversation" };

export default async function AiChatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const chat = user ? await getUserChat(id, user.id) : null;
  if (!chat) notFound();

  return (
    <div className="space-y-5">
      <Link
        href="/account/ai-history"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to AI chats
      </Link>

      <div>
        <h2 className="text-lg font-semibold">{chat.title ?? "Conversation"}</h2>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(chat.updatedAt)}
          {chat.product && (
            <>
              {" · about "}
              <Link href={`/products/${chat.product.slug}`} className="text-primary hover:underline">
                {chat.product.name}
              </Link>
            </>
          )}
        </p>
      </div>

      <div className="space-y-4">
        {chat.messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex gap-3", m.role === "USER" && "flex-row-reverse")}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full",
                m.role === "USER" ? "bg-secondary" : "bg-primary/10 text-primary",
              )}
            >
              {m.role === "USER" ? <User className="size-4" /> : <Sparkles className="size-4" />}
            </span>
            <div
              className={cn(
                "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                m.role === "USER" ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
