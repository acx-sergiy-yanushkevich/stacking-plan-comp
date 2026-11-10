import { useLayoutEffect, useRef, useState } from 'react';

/** Element width tracked with a ResizeObserver (falls back to the initial measure). */
export function useWidth<T extends HTMLElement>(fallback = 960): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Content box: an SVG drawn at this width inside a padded container must not be rescaled.
    const measure = () => {
      const cs = getComputedStyle(el);
      const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      setWidth(Math.max(0, Math.floor(el.getBoundingClientRect().width - pad)));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
