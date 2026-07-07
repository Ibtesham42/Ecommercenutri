import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { SubscriberTable, type SubscriberRow } from "@/components/admin/subscriber-table";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Subscribers", robots: { index: false } };

export default async function AdminSubscribersPage() {
  await guardSection("marketing");

  const [subscribers, activeCount] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, email: true, source: true, createdAt: true, unsubscribedAt: true },
    }),
    prisma.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
  ]);

  const rows: SubscriberRow[] = subscribers.map((s) => ({
    id: s.id,
    email: s.email,
    source: s.source,
    createdAt: s.createdAt.toISOString(),
    active: s.unsubscribedAt === null,
  }));

  return (
    <div>
      <PageHeader
        title="Newsletter subscribers"
        description={`${activeCount} active subscriber${activeCount === 1 ? "" : "s"}`}
      />
      <SubscriberTable subscribers={rows} />
    </div>
  );
}
