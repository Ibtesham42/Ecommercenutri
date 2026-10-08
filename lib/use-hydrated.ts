"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/**
 * False during SSR and hydration, true on the client right after. Prefer this
 * over `useEffect(() => setMounted(true))` for client-only gates (e.g. the
 * localStorage cart): that effect's update can be held back until any server
 * action fired from the same commit resolves — measured on /cart as the
 * skeleton lingering ~2s past hydration. The external-store re-render isn't.
 */
export function useHydrated() {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}
