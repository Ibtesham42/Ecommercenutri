import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { Input } from "@/components/ui/input";
import { NotificationTable, type NotificationRow } from "@/components/admin/notification-table";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

const FILTERS = [
  { label: "All", value: "" },
  { label: "Unread", value: "unread" },
  { label: "Read", value: "read" },
];

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await guardSection("customers");
  const { status = "", q = "" } = await searchParams;

  const where: Prisma.NotificationWhereInput = {
    ...(status === "unread" ? { read: false } : status === "read" ? { read: true } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
            { user: { name: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      read: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  const rows: NotificationRow[] = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    recipient: n.user.name ?? n.user.email ?? "—",
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={`${notifications.length} in-app notification${notifications.length === 1 ? "" : "s"}`}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/notifications${f.value ? `?status=${f.value}` : ""}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition hover:bg-accent",
              status === f.value && "border-primary bg-primary/10 text-primary",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <form action="/admin/notifications" className="mb-4 max-w-sm">
        {status && <input type="hidden" name="status" value={status} />}
        <Input name="q" placeholder="Search title, body or recipient…" defaultValue={q} />
      </form>

      <NotificationTable notifications={rows} />
    </div>
  );
}
