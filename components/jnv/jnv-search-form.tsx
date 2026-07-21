"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JNV_CLASS_LEVELS, JNV_FILE_KINDS, JNV_FILE_KIND_LABELS, jnvClassLabel } from "@/lib/jnv/catalog";

export function JnvSearchForm({
  initial,
}: {
  initial: { q: string; classLevel: string; kind: string };
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial.q);
  const [classLevel, setClassLevel] = useState(initial.classLevel || "__any");
  const [kind, setKind] = useState(initial.kind || "__any");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (classLevel !== "__any") params.set("class", classLevel);
    if (kind !== "__any") params.set("kind", kind);
    router.push(`/jnv/search?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by title, subject, teacher, keyword…"
        aria-label="Search resources"
        className="h-11"
      />
      <Select value={classLevel} onValueChange={setClassLevel}>
        <SelectTrigger className="h-11 w-full sm:w-40">
          <SelectValue placeholder="Any class" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__any">Any class</SelectItem>
          {JNV_CLASS_LEVELS.map((l) => (
            <SelectItem key={l} value={String(l)}>
              {jnvClassLabel(l)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={kind} onValueChange={setKind}>
        <SelectTrigger className="h-11 w-full sm:w-40">
          <SelectValue placeholder="Any type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__any">Any type</SelectItem>
          {JNV_FILE_KINDS.map((k) => (
            <SelectItem key={k} value={k}>
              {JNV_FILE_KIND_LABELS[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" className="h-11 gap-1.5 bg-blue-600 hover:bg-blue-700">
        <Search className="size-4" /> Search
      </Button>
    </form>
  );
}
