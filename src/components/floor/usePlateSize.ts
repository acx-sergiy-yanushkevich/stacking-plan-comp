import { useCallback, useState, type RefCallback } from 'react';
import { sizeObserver } from '../../lib/host';
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

/** Just enough of an element and of a size observer for `observeWidth` (and its test) to work with. */
export interface Measurable {
  getBoundingClientRect(): { width: number };
}
type ObserverCtor = new (onResize: () => void) => { observe(el: never): void; disconnect(): void };

/**
 * Reports an element's width now and again whenever its box changes. Returns what stops it.
 * It watches with the host's size observer, or with `Observer` when one is given (a test); without either
 * (SSR, tests) it reports once.
 */
export function observeWidth(
  el: Measurable,
  onWidth: (width: number) => void,
  Observer?: ObserverCtor,
): () => void {
  const measure = () => onWidth(Math.max(0, Math.floor(el.getBoundingClientRect().width)));
  measure();
  const ro = Observer ? new Observer(measure) : sizeObserver(measure);
  if (!ro) return () => {};
  ro.observe(el as never);
  return () => ro.disconnect();
}

/**
 * Tracks the plate container's width and derives the plate's drawing size.
 *
 * The ref is a callback: it measures when the element is attached, not when the component that owns the
 * hook mounts. The Building view renders its plate only while a floor is open, so the element appears
 * (and goes, and comes back) long after the view mounted; each time it is measured and observed afresh,
 * and the observer of the element that left is disconnected.
 */
export function usePlateSize(aspect: number, fallbackWidth = 640): [RefCallback<HTMLDivElement>, PlateSize] {
  const [cw, setCw] = useState(fallbackWidth);
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    return observeWidth(el, setCw);
  }, []);
  return [ref, plateSize(cw, aspect)];
}
