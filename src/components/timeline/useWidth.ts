import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * Measured content width of the referenced element, never below `min`.
 * SSR and tests (no ResizeObserver) get `min`. Measurement happens before paint so
 * the SVG is never drawn at the wrong width for a frame.
 */
export function useWidth<T extends HTMLElement>(min = 640): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(min);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => setWidth(Math.max(min, Math.floor(el.clientWidth)));
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return [ref, width];
}
