import { useSyncExternalStore } from 'react';

/**
 * The row of the Area panel the Map is lighting, by its place key (`stopKey` / `categoryKey`): the panel sets it
 * on hover or focus of a row, the Map sets it when a pin is clicked, and both draw it. One value for the page:
 * the panel and the map sit in different parts of the tree and share nothing else.
 */
let current: string | null = null;
const listeners = new Set<() => void>();

export const placeHighlight = {
  get: (): string | null => current,
  set(key: string | null) {
    if (key === current) return;
    current = key;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

/** The lit key, re-rendering when it changes. */
export const usePlaceHighlight = (): string | null => useSyncExternalStore(placeHighlight.subscribe, placeHighlight.get, () => null);

/** How a place group is drawn: the pin's (and the panel row's) colour class, and the icon a transit stop wears. */
export function placeLook(group: string): { cls: string; icon?: 'bus' | 'train' } {
  switch (group) {
    case 'Bus':
      return { cls: 'transit', icon: 'bus' };
    case 'Rail':
      return { cls: 'transit', icon: 'train' };
    case 'Restaurants':
      return { cls: 'food' };
    case 'Cafés':
      return { cls: 'cafe' };
    case 'Hotels':
      return { cls: 'hotel' };
    case 'Fitness':
      return { cls: 'fitness' };
    case 'Banks':
      return { cls: 'bank' };
    case 'Parking':
      return { cls: 'parking' };
    default:
      return { cls: 'other' };
  }
}
