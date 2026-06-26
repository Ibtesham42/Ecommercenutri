"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Eye, EyeOff, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HomeSectionEditDialog,
  type EditTarget,
} from "@/components/admin/home-section-editor";
import type { SectionEditorKind, HomeContentMap } from "@/lib/home-content";
import {
  toggleHomeSection,
  reorderHomeSections,
} from "@/lib/actions/admin/home-sections";

export type HomeSectionRow = {
  key: string;
  label: string;
  note?: string;
  enabled: boolean;
  editorKind: SectionEditorKind;
};

export function HomeSectionsManager({
  sections,
  content,
}: {
  sections: HomeSectionRow[];
  content: HomeContentMap;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<HomeSectionRow[]>(sections);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  function buildTarget(row: HomeSectionRow): EditTarget | null {
    const label = row.label;
    switch (row.key) {
      case "hero":
        return { kind: "hero", key: "hero", label, value: content.hero };
      case "aiBanner":
        return { kind: "aiBanner", key: "aiBanner", label, value: content.aiBanner };
      case "categories":
      case "featured":
      case "bestSellers":
      case "recommended":
        return { kind: "heading", key: row.key, label, value: content[row.key] };
      case "whyChooseUs":
        return { kind: "whyChooseUs", key: "whyChooseUs", label, value: content.whyChooseUs };
      case "testimonials":
        return { kind: "testimonials", key: "testimonials", label, value: content.testimonials };
      default:
        return null;
    }
  }

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
          {s.editorKind !== "none" && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setEditTarget(buildTarget(s))}
              aria-label={`Edit ${s.label}`}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          <Switch
            checked={s.enabled}
            onCheckedChange={(v) => onToggle(s.key, v)}
            aria-label={`Toggle ${s.label}`}
          />
        </li>
      ))}
      <HomeSectionEditDialog target={editTarget} onClose={() => setEditTarget(null)} />
    </ul>
  );
}
