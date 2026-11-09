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

/** Keys pinned by a click on a finder option: drawn with the related ring until the finder clears. */
let pinned: Set<string> | null = null;
const pinListeners = new Set<() => void>();
export function setPinnedKeys(next: Set<string> | null) {
  pinned = next;
  for (const l of pinListeners) l();
}
export function usePinnedKeys(): Set<string> | null {
  return useSyncExternalStore(
    (l) => {
      pinListeners.add(l);
      return () => pinListeners.delete(l);
    },
    () => pinned,
    () => null,
  );
}
