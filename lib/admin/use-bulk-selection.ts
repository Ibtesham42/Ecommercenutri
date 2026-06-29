"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Row-selection state for admin bulk actions. Pass the ids currently rendered
 * (already filtered/searched); the hook prunes any stale selections so the
 * select-all + count always reflect what's on screen.
 */
export function useBulkSelection(ids: string[]) {
  const [raw, setRaw] = useState<ReadonlySet<string>>(() => new Set());

  const present = useMemo(() => new Set(ids), [ids]);
  const selected = useMemo(
    () => new Set([...raw].filter((id) => present.has(id))),
    [raw, present],
  );

  const toggle = useCallback((id: string) => {
    setRaw((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setRaw((prev) => {
      const allOn = ids.length > 0 && ids.every((id) => prev.has(id));
      return allOn ? new Set() : new Set(ids);
    });
  }, [ids]);

  const clear = useCallback(() => setRaw(new Set()), []);

  const selectedIds = useMemo(() => [...selected], [selected]);
  const count = selectedIds.length;
  const allSelected = ids.length > 0 && count === ids.length;
  const someSelected = count > 0 && !allSelected;

  return {
    selectedIds,
    count,
    allSelected,
    someSelected,
    isSelected: useCallback((id: string) => selected.has(id), [selected]),
    toggle,
    toggleAll,
    clear,
  };
}
