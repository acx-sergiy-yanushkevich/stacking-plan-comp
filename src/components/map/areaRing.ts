import { useSyncExternalStore } from 'react';

/** The rings the Area figures are counted in, in miles. */
export type RingMiles = 1 | 3 | 5;

/**
 * The ring the Map draws and frames, and the Area panel compares with the US: one choice for the page. The Map
 * sets it with its own switch (the ring is what it draws); the Area panel follows it, and beside the plan views,
 * where there is no map, sets it with its own (round 25: the panel's switch moved the figures and not the map).
 */
let current: RingMiles = 1;
const listeners = new Set<() => void>();

export const areaRing = {
  get: (): RingMiles => current,
  set(miles: RingMiles) {
    if (miles === current) return;
    current = miles;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export const useAreaRing = (): RingMiles => useSyncExternalStore(areaRing.subscribe, areaRing.get, (): RingMiles => 1);

/** "1 mile", "3 miles": a ring's name in words. */
export const ringName = (miles: number) => `${miles} ${miles === 1 ? 'mile' : 'miles'}`;
