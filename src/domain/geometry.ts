import type { GeoPolygon, Property } from './types';
import type { FloorView } from './derive';

export type Pt = [number, number];

const FT_TO_M = 0.3048;

/** Outer ring of a GeoJSON polygon without the closing duplicate point. */
function openRing(poly: GeoPolygon): number[][] {
  const ring = poly.coordinates[0] ?? [];
  if (ring.length > 1) {
    const [a, b] = [ring[0], ring[ring.length - 1]];
    if (a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
  }
  return ring.slice();
}

/**
 * Equirectangular projection of a lng/lat polygon into a pixel box: x = lng·cos(meanLat),
 * y = −lat, uniformly scaled to fit inside `size` minus `pad` on every side and centred.
 */
export function projectPolygon(poly: GeoPolygon, size: { w: number; h: number }, pad = 8): Pt[] {
  const ring = openRing(poly);
  if (ring.length === 0) return [];
  const meanLat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const raw: Pt[] = ring.map(([lng, lat]) => [lng * k, -lat]);
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const bw = maxX - minX || 1e-12;
  const bh = maxY - minY || 1e-12;
  const innerW = Math.max(0, size.w - 2 * pad);
  const innerH = Math.max(0, size.h - 2 * pad);
  const scale = Math.min(innerW / bw, innerH / bh);
  const offX = pad + (innerW - bw * scale) / 2;
  const offY = pad + (innerH - bh * scale) / 2;
  return raw.map(([x, y]) => [offX + (x - minX) * scale, offY + (y - minY) * scale]);
}

/** Angle (radians) of the longest polygon edge: the long-axis direction for rectangular footprints. */
export function longAxisAngle(points: Pt[]): number {
  let best = 0;
  let bestLen = -1;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = dx * dx + dy * dy;
    if (len > bestLen) {
      bestLen = len;
      best = Math.atan2(dy, dx);
    }
  }
  return best;
}

const rotate = (points: Pt[], angle: number): Pt[] => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return points.map(([x, y]) => [x * c - y * s, x * s + y * c]);
};

/** Sutherland–Hodgman clip of a polygon against the half-plane `inside(p) >= 0`. */
function clipHalfPlane(points: Pt[], f: (p: Pt) => number): Pt[] {
  const out: Pt[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const cur = points[i];
    const prev = points[(i + n - 1) % n];
    const fc = f(cur);
    const fp = f(prev);
    const curIn = fc >= 0;
    const prevIn = fp >= 0;
    if (curIn) {
      if (!prevIn) out.push(intersect(prev, cur, fp, fc));
      out.push(cur);
    } else if (prevIn) out.push(intersect(prev, cur, fp, fc));
  }
  return out;
}

function intersect(a: Pt, b: Pt, fa: number, fb: number): Pt {
  const t = fa / (fa - fb);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Slice a polygon into strips along its long axis, each strip's width a share of the
 * bounding-box width after rotating the long axis horizontal (DESIGN.md §2.7).
 * Shares are normalised; one polygon is returned per share, in order.
 */
export function slicePolygon(points: Pt[], shares: number[]): Pt[][] {
  if (points.length < 3 || shares.length === 0) return shares.map(() => []);
  const total = shares.reduce((a, b) => a + Math.max(0, b), 0);
  const norm = total > 0 ? shares.map((s) => Math.max(0, s) / total) : shares.map(() => 1 / shares.length);

  const angle = longAxisAngle(points);
  const flat = rotate(points, -angle);
  const xs = flat.map((p) => p[0]);
  const minX = Math.min(...xs);
  const width = Math.max(...xs) - minX;

  const out: Pt[][] = [];
  let cum = 0;
  for (let i = 0; i < norm.length; i++) {
    const a = minX + cum * width;
    cum += norm[i];
    const b = i === norm.length - 1 ? minX + width : minX + cum * width;
    let strip = clipHalfPlane(flat, (p) => p[0] - a);
    strip = clipHalfPlane(strip, (p) => b - p[0]);
    out.push(rotate(strip, angle));
  }
  return out;
}

/** Absolute shoelace area. */
export function polygonArea(points: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export interface ExtrusionProperties {
  floorId: string;
  name: string;
  /** Metres above ground of the floor's underside. */
  base: number;
  /** Metres above ground of the floor's top. */
  height: number;
  tone: string;
  leasedPct: number;
  sequence: number;
}

export interface ExtrusionFeature {
  type: 'Feature';
  properties: ExtrusionProperties;
  geometry: GeoPolygon;
}

export interface ExtrusionCollection {
  type: 'FeatureCollection';
  features: ExtrusionFeature[];
}

/**
 * One fill-extrusion feature per floor (DESIGN.md §2.6): the footprint polygon with
 * base/height in metres from the floor's sequence and the floor height in feet.
 */
export function extrusionFeatures(
  p: Property,
  floors: FloorView[],
  toneOf: (f: FloorView) => string,
  floorHeightFt: number,
): ExtrusionCollection {
  const h = floorHeightFt * FT_TO_M;
  return {
    type: 'FeatureCollection',
    features: floors.map((f) => ({
      type: 'Feature',
      properties: {
        floorId: f.floor.id,
        name: f.floor.name,
        base: (f.floor.sequence - 1) * h,
        height: f.floor.sequence * h,
        tone: toneOf(f),
        leasedPct: f.leasable > 0 ? f.leased / f.leasable : 0,
        sequence: f.floor.sequence,
      },
      geometry: p.footprint,
    })),
  };
}
