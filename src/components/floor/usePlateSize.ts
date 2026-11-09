import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

export interface PlateSize {
  width: number;
  height: number;
}

const MIN_W = 480;
const MIN_H = 360;
const MAX_H = 520;
const MIN_ASPECT = 4 / 3;
const MAX_ASPECT = 2;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Plate size from a container width: aspect follows the footprint, clamped between 4:3 and 2:1. */
export function plateSize(containerWidth: number, aspect: number): PlateSize {
  const width = Math.max(MIN_W, Math.floor(containerWidth));
  const a = clamp(Number.isFinite(aspect) && aspect > 0 ? aspect : MIN_ASPECT, MIN_ASPECT, MAX_ASPECT);
  const height = Math.round(clamp(width / a, MIN_H, MAX_H));
  return { width, height };
}

/**
 * Tracks the plate container's width with a ResizeObserver (guarded for SSR and tests)
 * and derives the plate's drawing size.
 */
export function usePlateSize(aspect: number, fallbackWidth = 640): [RefObject<HTMLDivElement | null>, PlateSize] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [cw, setCw] = useState(fallbackWidth);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setCw(Math.max(0, Math.floor(el.getBoundingClientRect().width)));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, plateSize(cw, aspect)];
}
