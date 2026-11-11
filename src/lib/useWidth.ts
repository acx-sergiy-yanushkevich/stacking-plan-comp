import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import { computedStyle, sizeObserver } from './host';

/**
 * A width, in CSS px, for everything inside to be drawn at instead of the width it measures. The
 * printed report uses it: its plan is not on screen when it is drawn (so there is nothing to
 * measure), and what it measured in a preview would be the browser window's width, which is not the
 * paper's. With a fixed width the report is the same drawing on every screen.
 */
export const FixedWidth = createContext<number | null>(null);

/**
 * The content-box width of the referenced element (its padding is not drawable space), never below `min`,
 * tracked as it resizes; or the `FixedWidth` it sits in. Measured before paint, so an SVG is never drawn at
 * the wrong width for a frame. Where nothing is laid out (SSR, tests) it is `fallback`; where the host has
 * no size observer it is measured once. The Stack and the Timeline both use it (round 18: there were two).
 */
export function useWidth<T extends HTMLElement>(fallback = 960, min = 0): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const fixed = useContext(FixedWidth);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || fixed !== null) return;
    const measure = () => {
      const cs = computedStyle(el);
      const pad = cs ? (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) : 0;
      setWidth(Math.max(min, Math.floor(el.clientWidth - pad)));
    };
    measure();
    const watch = sizeObserver(measure);
    if (!watch) return;
    watch.observe(el);
    return () => watch.disconnect();
  }, [fixed, min]);
  return [ref, fixed ?? width];
}
