import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';

/**
 * A width, in CSS px, for everything inside to be drawn at instead of the width it measures. The
 * printed report uses it: its plan is not on screen when it is drawn (so there is nothing to
 * measure), and what it measured in a preview would be the browser window's width, which is not the
 * paper's. With a fixed width the report is the same drawing on every screen.
 */
export const FixedWidth = createContext<number | null>(null);

/** Element width tracked with a ResizeObserver (falls back to the initial measure), or the `FixedWidth` it sits in. */
export function useWidth<T extends HTMLElement>(fallback = 960): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const fixed = useContext(FixedWidth);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || fixed !== null) return;
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
  }, [fixed]);
  return [ref, fixed ?? width];
}
