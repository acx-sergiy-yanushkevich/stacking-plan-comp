import type { ExpressionSpecification } from 'maplibre-gl';
import type { FloorView } from '../../domain/derive';
import type { ExtrusionCollection, ExtrusionProperties } from '../../domain/geometry';
import { toneFor, type Tone } from '../../domain/lenses';
import type { GeoPolygon } from '../../domain/types';
import type { Lens } from '../../state/planState';

/** Pure helpers behind the map: tone selection, colour resolution, geometry tweaks, expressions. */

export const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
export const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';
export const FALLBACK_HEX = '#d8dde3';
export const BUILDINGS_LIGHT = '#cfd4da';
export const BUILDINGS_DARK = '#3a3f47';
/** Camera defaults (DESIGN.md §2.6). */
export const CAMERA = { zoom: 17.3, pitch: 55, bearing: -20, maxPitch: 70 } as const;

export const SOURCE_FLOORS = 'floors';
export const LAYER_FLOORS = 'floors-3d';
export const LAYER_CAP = 'floors-cap';
export const LAYER_BUILDINGS = 'sp-buildings-3d';

/**
 * The floor's dominant tone for a lens: the tone carrying the most SF across its segments.
 * Ties go to `leased`; a floor without segments reads as empty.
 */
export function dominantTone(f: FloorView, lens: Lens, safe: boolean): Tone {
  if (f.segments.length === 0) return 'empty';
  const sfBy = new Map<Tone, number>();
  for (const s of f.segments) {
    const t = toneFor(s, lens, safe);
    sfBy.set(t, (sfBy.get(t) ?? 0) + s.size);
  }
  let best: Tone | null = null;
  let bestSf = -1;
  for (const [t, sf] of sfBy) {
    if (sf > bestSf || (sf === bestSf && t === 'leased')) {
      best = t;
      bestSf = sf;
    }
  }
  return best ?? 'empty';
}

/** `#rgb` or `#rrggbb` (any case, surrounding space) → lowercase `#rrggbb`; anything else → null. */
export function normalizeHex(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v);
  if (m) return `#${[m[1], m[2], m[3]].map((c) => Math.min(255, Number(c)).toString(16).padStart(2, '0')).join('')}`;
  return null;
}

type ReadVar = (name: string) => string;
const readCssVar: ReadVar = (name) => (typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name));

/** The `--tone-<tone>-fill` token as a hex; `transparent`/unset tones fall back to a neutral grey. */
export function resolveToneHex(tone: string, read: ReadVar = readCssVar): string {
  return normalizeHex(read(`--tone-${tone}-fill`)) ?? FALLBACK_HEX;
}

/** Any token (e.g. `--sp-color-brand`) as a hex, with a fallback. */
export function resolveVarHex(name: string, fallback: string, read: ReadVar = readCssVar): string {
  return normalizeHex(read(name)) ?? fallback;
}

/** Linear blend of two hex colours; t = 0 → a, t = 1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = normalizeHex(a) ?? FALLBACK_HEX;
  const pb = normalizeHex(b) ?? '#ffffff';
  const ch = (i: number) => {
    const x = parseInt(pa.slice(1 + i * 2, 3 + i * 2), 16);
    const y = parseInt(pb.slice(1 + i * 2, 3 + i * 2), 16);
    return Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  };
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

/**
 * Scale a polygon about its centroid. The property floors are drawn a hair larger than the
 * OSM footprint so their walls never coincide with the tiles' own extrusion of the same
 * building (coincident faces z-fight).
 */
export function inflatePolygon(poly: GeoPolygon, factor: number): GeoPolygon {
  const ring = poly.coordinates[0] ?? [];
  if (ring.length === 0 || factor === 1) return poly;
  const open = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  const cx = open.reduce((s, c) => s + c[0], 0) / open.length;
  const cy = open.reduce((s, c) => s + c[1], 0) / open.length;
  return {
    type: 'Polygon',
    coordinates: [ring.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor]), ...poly.coordinates.slice(1)],
  };
}

export interface FloorFeature {
  type: 'Feature';
  id: number;
  properties: ExtrusionProperties;
  geometry: GeoPolygon;
}

export interface FloorFeatureCollection {
  type: 'FeatureCollection';
  features: FloorFeature[];
}

/** Give every floor feature a numeric id (for feature-state) and the inflated footprint. */
export function toFloorFeatures(fc: ExtrusionCollection, inflate = 1): FloorFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fc.features.map((f) => ({ type: 'Feature', id: f.properties.sequence, properties: f.properties, geometry: inflatePolygon(f.geometry, inflate) })),
  };
}

/** `match` on the feature's `tone`, each tone lightened by `blend` towards white. */
export function toneColorExpression(hexByTone: Record<string, string>, blend = 0): ExpressionSpecification {
  const entries = Object.entries(hexByTone);
  if (entries.length === 0) return ['literal', FALLBACK_HEX] as unknown as ExpressionSpecification;
  const expr: unknown[] = ['match', ['get', 'tone']];
  for (const [tone, hex] of entries) expr.push(tone, blend > 0 ? mixHex(hex, '#ffffff', blend) : hex);
  expr.push(blend > 0 ? mixHex(FALLBACK_HEX, '#ffffff', blend) : FALLBACK_HEX);
  return expr as ExpressionSpecification;
}

/** Hovered floors brighten, the selected floor brightens more; everything else is its tone. */
export function floorColorExpression(hexByTone: Record<string, string>): ExpressionSpecification {
  return [
    'case',
    ['boolean', ['feature-state', 'hover'], false],
    toneColorExpression(hexByTone, 0.22),
    ['boolean', ['feature-state', 'selected'], false],
    toneColorExpression(hexByTone, 0.35),
    toneColorExpression(hexByTone, 0),
  ] as ExpressionSpecification;
}
