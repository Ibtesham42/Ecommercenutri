"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  toggleHomeSection,
  reorderHomeSections,
} from "@/lib/actions/admin/home-sections";

export type HomeSectionRow = {
  key: string;
  label: string;
  note?: string;
  enabled: boolean;
};

export function HomeSectionsManager({ sections }: { sections: HomeSectionRow[] }) {
  const router = useRouter();
  const [order, setOrder] = useState<HomeSectionRow[]>(sections);
  const [dragKey, setDragKey] = useState<string | null>(null);

  // Re-sync from the server after a refresh (when not mid-drag).
  if (
    dragKey === null &&
    sections.map((s) => s.key + s.enabled).join() !==
      order.map((s) => s.key + s.enabled).join()
  ) {
    setOrder(sections);
  }

  function onToggle(key: string, enabled: boolean) {
    setOrder((o) => o.map((s) => (s.key === key ? { ...s, enabled } : s)));
    toggleHomeSection(key, enabled).then((res) => {
      if (res.ok) {
        toast.success(enabled ? "Section shown" : "Section hidden");
        router.refresh();
      } else {
        toast.error(res.error);
        setOrder((o) => o.map((s) => (s.key === key ? { ...s, enabled: !enabled } : s)));
      }
    });
  }

  function onDrop(targetKey: string) {
    if (!dragKey || dragKey === targetKey) {
      setDragKey(null);
      return;
    }
    const next = [...order];
    const from = next.findIndex((s) => s.key === dragKey);
    const to = next.findIndex((s) => s.key === targetKey);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    setDragKey(null);
    reorderHomeSections(next.map((s) => s.key)).then((res) => {
      if (res.ok) {
        toast.success("Order updated");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <ul className="max-w-2xl space-y-2">
      {order.map((s) => (
        <li
          key={s.key}
          draggable
          onDragStart={() => setDragKey(s.key)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(s.key)}
          className={`flex items-center gap-3 rounded-xl border bg-background p-3.5 transition ${
            dragKey === s.key ? "opacity-50" : ""
          } ${!s.enabled ? "opacity-70" : ""}`}
        >
          <span className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden>
            <GripVertical className="size-5" />
          </span>
          <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
            {s.enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{s.label}</p>
            {s.note && <p className="truncate text-xs text-muted-foreground">{s.note}</p>}
          </div>
          <Badge variant={s.enabled ? "default" : "secondary"}>
            {s.enabled ? "Shown" : "Hidden"}
          </Badge>
          <Switch
            checked={s.enabled}
            onCheckedChange={(v) => onToggle(s.key, v)}
            aria-label={`Toggle ${s.label}`}
          />
        </li>
      ))}
    </ul>
  );
}
