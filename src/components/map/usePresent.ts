import { useCallback, useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { cancelFrame, requestFrame } from '../../lib/host';

export const PRESENT_DEG_PER_FRAME = 0.15;

export interface UsePresentOptions {
  map: MapLibreMap | null;
  /** False under `prefers-reduced-motion`: Present cannot start. */
  enabled: boolean;
  /** Runs as Present starts: the camera leans into 3D, so the orbit shows the building among its neighbours. */
  onStart?: () => void;
}

/**
 * Present mode (DESIGN.md §2.6): a slow orbit of the building in 3D. Any drag or wheel on the map stops it.
 * (Until round 24 it also played the as-of date forward, a lease-by-lease time-lapse of the floors; the Map
 * shows the surroundings now, and the floors are the Building tab's.)
 */
export function usePresent({ map, enabled, onStart }: UsePresentOptions) {
  const [presenting, setPresenting] = useState(false);

  useEffect(() => {
    if (!presenting || !map || !enabled) {
      if (presenting && !enabled) setPresenting(false);
      return;
    }
    onStart?.();
    let raf: number | null = null;
    const step = () => {
      map.setBearing(map.getBearing() + PRESENT_DEG_PER_FRAME);
      raf = requestFrame(step);
    };
    raf = requestFrame(step);
    const stop = () => setPresenting(false);
    map.on('dragstart', stop);
    map.on('wheel', stop);
    return () => {
      cancelFrame(raf);
      map.off('dragstart', stop);
      map.off('wheel', stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenting, map, enabled]);

  const start = useCallback(() => {
    if (enabled && map) setPresenting(true);
  }, [enabled, map]);
  const stop = useCallback(() => setPresenting(false), []);
  const toggle = useCallback(() => setPresenting((p) => (p ? false : enabled && !!map)), [enabled, map]);

  return { presenting, start, stop, toggle };
}
