"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BellNotification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string; // ISO
};

/** Account notification bell. Opening marks everything read (optimistically + on
 *  the server). Mounted in the storefront header for signed-in users. */
export function NotificationBell({
  initialUnread,
  items,
}: {
  initialUnread: number;
  items: BellNotification[];
}) {
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (o && unread > 0) {
      setUnread(0);
      markAllNotificationsRead().catch(() => {});
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-11 text-foreground/80 hover:bg-accent hover:text-foreground sm:size-10"
          aria-label="Notifications"
        >
          <Bell className="size-[22px] sm:size-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-bold leading-5 text-gold-foreground shadow-sm">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          <Link href="/account/returns" className="text-xs text-primary hover:underline">
            Returns
          </Link>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No notifications yet
          </p>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="divide-y">
              {items.map((n) => {
                const inner = (
                  <div className={cn("px-4 py-3", !n.read && "bg-accent/40")}>
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDateTime(n.createdAt)}
                    </p>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} onClick={() => setOpen(false)} className="block hover:bg-accent/30">
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
