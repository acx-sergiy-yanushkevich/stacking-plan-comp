import { useSyncExternalStore } from 'react';

/**
 * Transient highlight (e.g. hovering a finder option) shared between the inspector and the plan
 * without touching the URL state. Null means "no override".
 */
let keys: Set<string> | null = null;
const listeners = new Set<() => void>();

export function setHoverKeys(next: Set<string> | null) {
  keys = next;
  for (const l of listeners) l();
}

export function useHoverKeys(): Set<string> | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => keys,
    () => null,
  );
}
