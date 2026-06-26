import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { MessagesManager, type MessageRow } from "@/components/admin/messages-manager";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };

export default async function AdminMessagesPage() {
  await guardSection("customers");

  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    include: { replies: { orderBy: { createdAt: "asc" } } },
  });

  const rows: MessageRow[] = messages.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    subject: m.subject,
    message: m.message,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    replies: m.replies.map((r) => ({
      id: r.id,
      body: r.body,
      adminName: r.adminName,
      delivered: r.delivered,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
    })),
  }));

  return (
    <div>
      <PageHeader
        title="Messages"
        description="Enquiries submitted through the storefront contact form."
      />
      <MessagesManager messages={rows} />
    </div>
  );
}
