import { useSyncExternalStore } from 'react';
import type { ChosenOption } from '../domain/finder';

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

/**
 * The finder option kept by a click on its row: every suite in it, so the plan can light all of them
 * and the inspector can list them, until the finder clears or another row is chosen.
 */
let option: ChosenOption | null = null;
let pinned: Set<string> | null = null;
const pinListeners = new Set<() => void>();
const subscribePin = (l: () => void) => {
  pinListeners.add(l);
  return () => pinListeners.delete(l);
};
export function setPinnedOption(next: ChosenOption | null) {
  if (next === option) return;
  option = next;
  // A single suite needs no ring of its own: it is the selection.
  pinned = next && next.keys.length > 1 ? new Set(next.keys) : null;
  for (const l of pinListeners) l();
}
export function usePinnedOption(): ChosenOption | null {
  return useSyncExternalStore(subscribePin, () => option, () => null);
}
/** The chosen option's suites when it has more than one: drawn with the related ring. */
export function usePinnedKeys(): Set<string> | null {
  return useSyncExternalStore(subscribePin, () => pinned, () => null);
}

/** The floor under the pointer (in the stack or on the building model), so each can light it in the other. */
let hoverFloor: string | null = null;
const floorListeners = new Set<() => void>();
export function setHoverFloor(next: string | null) {
  if (next === hoverFloor) return;
  hoverFloor = next;
  for (const l of floorListeners) l();
}
export function useHoverFloor(): string | null {
  return useSyncExternalStore(
    (l) => {
      floorListeners.add(l);
      return () => floorListeners.delete(l);
    },
    () => hoverFloor,
    () => null,
  );
}
