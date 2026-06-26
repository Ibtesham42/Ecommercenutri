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
  });

  const rows: MessageRow[] = messages.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    subject: m.subject,
    message: m.message,
    handled: m.handled,
    createdAt: m.createdAt.toISOString(),
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
