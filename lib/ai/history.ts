import { prisma } from "@/lib/prisma";
import { truncate } from "@/lib/format";

/**
 * Persist one user→assistant turn for a logged-in user. Conversations are keyed
 * by (userId, sessionId); the first user message becomes the chat title.
 * Best-effort — failures are logged, never thrown into the request.
 */
export async function persistChatTurn(opts: {
  userId: string;
  sessionId: string;
  productId?: string | null;
  userText: string;
  assistantText: string;
}): Promise<void> {
  const { userId, sessionId, productId, userText, assistantText } = opts;
  if (!assistantText.trim()) return;

  try {
    const existing = await prisma.aIChat.findFirst({
      where: { sessionId, userId },
      select: { id: true },
    });

    const chatId =
      existing?.id ??
      (
        await prisma.aIChat.create({
          data: {
            userId,
            sessionId,
            productId: productId ?? null,
            title: truncate(userText, 60),
          },
          select: { id: true },
        })
      ).id;

    if (existing) {
      await prisma.aIChat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
      });
    }

    await prisma.aIMessage.createMany({
      data: [
        { chatId, role: "USER", content: userText },
        { chatId, role: "ASSISTANT", content: assistantText },
      ],
    });
  } catch (err) {
    console.error("[ai] persistChatTurn failed:", err);
  }
}

/** Fetch a user's chat with its messages, or null if not theirs. */
export async function getUserChat(chatId: string, userId: string) {
  return prisma.aIChat.findFirst({
    where: { id: chatId, userId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      product: { select: { name: true, slug: true } },
    },
  });
}
