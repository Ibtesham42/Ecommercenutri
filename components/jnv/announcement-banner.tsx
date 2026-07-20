import { Megaphone, Pin } from "lucide-react";
import { formatDate } from "@/lib/format";

type Announcement = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: Date | string;
};

export function AnnouncementBanner({ announcements }: { announcements: Announcement[] }) {
  if (announcements.length === 0) return null;
  return (
    <div className="mx-auto mb-6 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="space-y-2">
        {announcements.slice(0, 3).map((a) => (
          <div
            key={a.id}
            className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40"
          >
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-blue-600 text-white">
              {a.pinned ? <Pin className="size-4" /> : <Megaphone className="size-4" />}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-blue-900 dark:text-blue-200">{a.title}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-blue-800/80 dark:text-blue-300/80">{a.body}</p>
              <p className="mt-1 text-xs text-blue-700/60 dark:text-blue-400/60">{formatDate(a.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
