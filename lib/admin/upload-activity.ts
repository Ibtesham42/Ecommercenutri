import { useSyncExternalStore } from "react";

/**
 * Count of admin uploads currently in flight (browser-only module state). Save
 * buttons use `useUploadsInFlight()` to stay disabled until every upload in the
 * open form has finished, so a record can't be saved with a half-uploaded (or
 * missing) image — which used to fail silently on the `required` rule.
 */
let inFlight = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Mark one upload as started; call the returned function exactly once when it ends. */
export function trackUpload(): () => void {
  inFlight++;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    inFlight = Math.max(0, inFlight - 1);
    emit();
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while any admin upload is in progress. */
export function useUploadsInFlight(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => inFlight > 0,
    () => false,
  );
}
