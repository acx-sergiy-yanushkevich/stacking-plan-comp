import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { GeoPolygon } from '../../domain/types';
import { levelPolygon, projectPolygon } from '../../domain/geometry';

export interface PlateSize {
  width: number;
  height: number;
}

const MIN_W = 480;
const MIN_H = 300;
const MAX_H = 520;
const MIN_ASPECT = 4 / 3;
const MAX_ASPECT = 3;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Width over height of the footprint once its long axis is levelled; 4:3 when it has no area. */
export function plateAspect(footprint: GeoPolygon): number {
  const pts = levelPolygon(projectPolygon(footprint, { w: 1000, h: 1000 }, 0), { w: 1000, h: 1000 }, 0);
  if (pts.length < 3) return 4 / 3;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  return h > 0 ? w / h : 4 / 3;
}

/** Plate size from a container width: aspect follows the footprint, clamped between 4:3 and 3:1. */
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
