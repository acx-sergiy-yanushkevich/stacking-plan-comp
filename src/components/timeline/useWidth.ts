import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * Measured content-box width of the referenced element (its padding is not drawable space),
 * never below `min`. SSR and tests (no layout) get `initial`. Measurement happens before paint
 * so the SVG is never drawn at the wrong width for a frame.
 */
export function useWidth<T extends HTMLElement>(min = 640, initial = min): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      const cs = getComputedStyle(el);
      const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      setWidth(Math.max(min, Math.floor(el.clientWidth - pad)));
    };
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return [ref, width];
}
