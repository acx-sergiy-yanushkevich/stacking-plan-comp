import type { ExpressionSpecification } from 'maplibre-gl';
import type { FloorView, Segment } from '../../domain/derive';
import type { ExtrusionCollection, ExtrusionProperties } from '../../domain/geometry';
import { num } from '../../domain/format';
import { stageRank, toneFor, type Tone } from '../../domain/lenses';
import { canShowIssues, canShowTenantRisk } from '../../domain/safe';
import { askingSegments, furthestStage, inPlaceSegments } from '../building/floorFact';
import { nextExpiry } from '../floor/floorData';
import type { GeoPolygon } from '../../domain/types';
import type { Lens } from '../../state/planState';
import { readRootStyle } from '../../lib/host';

/** Pure helpers behind the map: tone selection, colour resolution, geometry tweaks, expressions. */

export const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
export const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';
export const FALLBACK_HEX = '#d8dde3';
export const BUILDINGS_LIGHT = '#cfd4da';
export const BUILDINGS_DARK = '#3a3f47';
/** Camera defaults (DESIGN.md §2.6). */
export const CAMERA = { zoom: 18, pitch: 56, bearing: -24, maxPitch: 70 } as const;

export const SOURCE_FLOORS = 'floors';
export const LAYER_FLOORS = 'floors-3d';
export const LAYER_CAP = 'floors-cap';
export const LAYER_BUILDINGS = 'sp-buildings-3d';

/**
 * The floor's dominant tone for a lens: the tone carrying the most SF across its segments.
 * Ties go to `leased`; a floor without segments reads as empty.
 */
export function dominantTone(f: FloorView, lens: Lens, safe: boolean): Tone {
  return dominantAmong(f.segments, lens, safe);
}

function dominantAmong(segments: Segment[], lens: Lens, safe: boolean): Tone {
  if (segments.length === 0) return 'empty';
  const sfBy = new Map<Tone, number>();
  for (const s of segments) {
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

/**
 * What a row's tooltip and accessible name add to the floor's label, in exact SF: a unit for sale, an
 * area with no record ("not on the market" for a prospect). The label itself is the Building view's
 * (`floorLabelParts`, building/floorFact.ts), which already says when the space on offer is a sublease;
 * these are kept off the row so that the row and the Building view say the same thing.
 */
export function floorAlso(f: FloorView, safe: boolean): string {
  const sum = (kind: FloorView['segments'][number]['kind']) => f.segments.filter((s) => s.kind === kind).reduce((t, s) => t + s.size, 0);
  const forSale = sum('forsale');
  const gap = sum('unmarketed');
  const also: string[] = [];
  if (forSale > 0) also.push(`${num(forSale)} SF for sale`);
  if (gap > 0) also.push(`${num(gap)} SF ${canShowIssues(safe) ? 'not listed' : 'not on the market'}`);
  return also.join(', ');
}

/**
 * The colours of a floor's swatch in the map's list of floors. The swatch stands beside the floor's label,
 * so it shows the fact the label's words name (building/floorFact.ts), in the legend's colour for it; it
 * is not the floor's dominant colour where the two differ (the 3D floors are drawn suite by suite, each
 * in its own colour):
 *
 *   expiration  the step of the floor's next lease expiry, the first date the label gives ("expires
 *               Apr '27 – Sep '28" is the "< 6 mo" step, whatever colours most of the floor); the
 *               at-risk tone as the second colour where the label says holdover or month-to-month
 *   deals       the furthest stage a live deal has reached, the stage the label names
 *   rent        the band of the asking rent where the label gives one (the largest space on offer),
 *               else the band of most of the rent in place that the label gives
 *   status      the space on offer where the label leads with it ("9,300 SF available" is the Available
 *               tone, "4,200 SF sublease available" the Sublease tone), else the state of most of the floor
 *
 * and, in the status and expiration lenses, a second colour: the at-risk tone where the floor holds a
 * holdover or month-to-month lease, else the expiring tone where a lease ends within 12 months, unless
 * that is the swatch's colour already. The label says the same in words ("holdover", "month-to-month",
 * "expires < 12 mo"). There is none in prospect-safe mode, where those leases are drawn as plain leased
 * (`toneFor`).
 *
 * A floor whose label has no such fact (nothing on offer, no lease, no deal, no rent to show) keeps its
 * dominant tone. The 3D floors are not colored by this: each suite is drawn in its own tone, so a floor
 * with space on offer already shows it on the map. Only the flat elevation drawn when the map cannot load
 * (FootprintFallback) gives a floor one color, the state of most of it (`dominantTone`): a band has no
 * words beside it, and the list of floors, with these swatches, still stands next to it.
 */
export function swatchTones(f: FloorView, lens: Lens, safe: boolean): { tone: Tone; accent: Tone | null } {
  let tone = dominantTone(f, lens, safe);
  if (lens === 'expiry') {
    const next = canShowTenantRisk(safe) ? nextExpiry(f) : null;
    if (next) tone = toneFor(next, lens, safe);
  } else if (lens === 'deals') {
    const stage = furthestStage(f, safe);
    if (stage) tone = `deal-${stageRank(stage)}` as Tone;
  } else if (lens === 'rent') {
    const asking = askingSegments(f, safe);
    const named = asking.length > 0 ? asking : inPlaceSegments(f, safe);
    if (named.length > 0) tone = dominantAmong(named, lens, safe);
  } else if (lens === 'status' && f.available > 0) {
    // The label leads with the space on offer (`spaceOf`): a sublease only where none of it is direct.
    const direct = f.segments.some((s) => s.kind === 'available' && !s.availableFrom);
    tone = direct ? 'available' : 'sublease';
  }
  const tones = new Set(f.segments.map((s) => toneFor(s, lens, safe)));
  const accent = (['risk', 'expiring'] as const).find((t) => tones.has(t) && tone !== t) ?? null;
  return { tone, accent };
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
const readCssVar: ReadVar = (name) => readRootStyle(name);

/** The `--tone-<tone>-fill` token as a hex; `transparent`/unset tones fall back to a neutral grey. */
export function resolveToneHex(tone: string, read: ReadVar = readCssVar): string {
  // A skin may make a tone translucent on screen; extrusions need its opaque equivalent.
  return normalizeHex(read(`--tone-${tone}-solid`)) ?? normalizeHex(read(`--tone-${tone}-fill`)) ?? FALLBACK_HEX;
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
    features: fc.features.map((f, i) => ({ type: 'Feature', id: i + 1, properties: f.properties, geometry: inflatePolygon(f.geometry, inflate) })),
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

const ORDERED = new Set(['<', '<=', '>', '>=']);
const isGet = (x: unknown): x is ['get', string] => Array.isArray(x) && x.length === 2 && x[0] === 'get' && typeof x[1] === 'string';

/**
 * A basemap filter with its ordered comparisons made safe for features that lack the property compared.
 * The light basemap filters its road shields with `["<=", ["get", "ref_length"], 6]`; a road without a
 * `ref_length` makes that comparison an error, which MapLibre reports in the console on every load (and
 * then leaves the feature out). Here the property falls back to a number that fails the comparison, so
 * the same features are left out and nothing is reported. Returns the filter itself when it has no such
 * comparison, so the caller can tell whether there is anything to set.
 */
export function guardedFilter<T>(filter: T): T {
  let changed = false;
  const walk = (x: unknown): unknown => {
    if (!Array.isArray(x)) return x;
    const [op, a, b] = x;
    if (x.length === 3 && typeof op === 'string' && ORDERED.has(op) && isGet(a) && typeof b === 'number') {
      changed = true;
      // Less-than fails for a huge number, greater-than for a hugely negative one.
      return [op, ['coalesce', a, op.startsWith('<') ? Number.MAX_SAFE_INTEGER : -Number.MAX_SAFE_INTEGER], b];
    }
    return x.map(walk);
  };
  const out = walk(filter);
  return changed ? (out as T) : filter;
}
