import Link from "next/link";
import type { Metadata } from "next";
import { MessageSquare, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "AI chat history" };

export default async function AiHistoryPage() {
  const user = await getCurrentUser();
  const chats = await prisma.aIChat.findMany({
    where: { userId: user!.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });

  if (chats.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <MessageSquare className="mx-auto size-10 text-muted-foreground/40" />
        <p className="mt-3 font-medium">No AI conversations yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Chat with our AI nutrition expert and your history will appear here.
        </p>
        <Button asChild className="mt-5 gap-2">
          <Link href="/assistant">
            <Sparkles className="size-4" /> Ask the AI expert
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {chats.map((chat) => (
        <Link
          key={chat.id}
          href={`/account/ai-history/${chat.id}`}
          className="block rounded-xl border p-4 transition hover:border-foreground/20 hover:bg-accent/30"
        >
          <p className="font-medium">{chat.title ?? "Conversation"}</p>
          <p className="text-xs text-muted-foreground">
            {chat._count.messages} messages · {formatDateTime(chat.updatedAt)}
          </p>
        </Link>
      ))}
    </div>
  );
}
