import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { addMonths } from '../../domain/dates';
import type { ISODate } from '../../domain/types';

export const PRESENT_MONTHS = 60;
export const PRESENT_STEP_MS = 900;
export const PRESENT_DEG_PER_FRAME = 0.15;

export interface UsePresentOptions {
  map: MapLibreMap | null;
  today: ISODate;
  patch: (p: { asOf: ISODate }) => void;
  /** False under `prefers-reduced-motion`: Present cannot start. */
  enabled: boolean;
}

/**
 * Present mode (DESIGN.md §2.6): a slow orbit plus a time-lapse of the as-of date one month
 * every 900 ms across five years, looping. Any drag or wheel on the map stops it; stopping
 * returns the plan to today so the KPIs never linger on a projected date by accident.
 */
export function usePresent({ map, today, patch, enabled }: UsePresentOptions) {
  const [presenting, setPresenting] = useState(false);
  const patchRef = useRef(patch);
  patchRef.current = patch;

  useEffect(() => {
    if (!presenting || !map || !enabled) {
      if (presenting && !enabled) setPresenting(false);
      return;
    }
    let raf = 0;
    let last = performance.now();
    let month = 0;
    const step = (ts: number) => {
      map.setBearing(map.getBearing() + PRESENT_DEG_PER_FRAME);
      if (ts - last >= PRESENT_STEP_MS) {
        last = ts;
        month = (month + 1) % (PRESENT_MONTHS + 1);
        patchRef.current({ asOf: addMonths(today, month) });
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const stop = () => setPresenting(false);
    map.on('dragstart', stop);
    map.on('wheel', stop);
    return () => {
      cancelAnimationFrame(raf);
      map.off('dragstart', stop);
      map.off('wheel', stop);
      patchRef.current({ asOf: today });
    };
  }, [presenting, map, enabled, today]);

  const start = useCallback(() => {
    if (enabled && map) setPresenting(true);
  }, [enabled, map]);
  const stop = useCallback(() => setPresenting(false), []);
  const toggle = useCallback(() => setPresenting((p) => (p ? false : enabled && !!map)), [enabled, map]);

  return { presenting, start, stop, toggle };
}
