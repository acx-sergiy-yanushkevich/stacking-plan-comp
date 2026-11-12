import type { Area } from './types';

/** A point on the map, in degrees. */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * One place the Map pins: a transit stop (`group` "Bus" or "Rail") or an amenity (`group` its category, as the
 * Area panel names it: "Restaurants", "Cafés"…). `key` is what the Area panel's row for it lights: the stop
 * itself, or the whole category.
 */
export interface Place extends LatLng {
  id: string;
  kind: 'transit' | 'amenity';
  group: string;
  key: string;
  name: string;
  distanceMi: number;
}

const M_PER_MI = 1609.344;
const M_PER_DEG_LAT = 111_320;
/** Amenities are counted within half a mile; a sample place is never drawn on the building itself. */
export const WALK_MI = 0.5;
const NEAREST_MI = 0.06;

/** The row key of a transit stop and of an amenity category: one row in the Area panel each. */
export const stopKey = (name: string) => `stop:${name}`;
export const categoryKey = (category: string) => `category:${category}`;

/** The point `miles` from `from` at a compass bearing (degrees, 0 = north). Flat-earth: exact enough over a few miles. */
export function offset(from: LatLng, miles: number, bearingDeg: number): LatLng {
  const m = miles * M_PER_MI;
  const b = (bearingDeg * Math.PI) / 180;
  const dLat = (m * Math.cos(b)) / M_PER_DEG_LAT;
  const dLng = (m * Math.sin(b)) / (M_PER_DEG_LAT * Math.cos((from.lat * Math.PI) / 180));
  return { lat: from.lat + dLat, lng: from.lng + dLng };
}

/** A closed ring `miles` around a point, as GeoJSON `[lng, lat]` pairs. */
export function ringCoordinates(center: LatLng, miles: number, steps = 96): number[][] {
  const out: number[][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const p = offset(center, miles, (i / steps) * 360);
    out.push([p.lng, p.lat]);
  }
  return out;
}

/** The ring's bounds as `[[west, south], [east, north]]`, for framing the map on it. */
export function ringBounds(center: LatLng, miles: number): [[number, number], [number, number]] {
  const n = offset(center, miles, 0);
  const e = offset(center, miles, 90);
  const s = offset(center, miles, 180);
  const w = offset(center, miles, 270);
  return [
    [w.lng, s.lat],
    [e.lng, n.lat],
  ];
}

/** FNV-1a, then mulberry32: the same sequence of numbers in [0, 1) for the same seed, on every load. */
function seeded(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One of a category, for a sample place's name ("Restaurant"). */
const ONE: Record<string, string> = { Restaurants: 'Restaurant', Cafés: 'Café', Hotels: 'Hotel', Fitness: 'Fitness studio', Banks: 'Bank', Parking: 'Parking' };
export const oneOf = (category: string) => ONE[category] ?? category;

/**
 * The places around a building that the Map pins, nearest first. Places with a position on record are drawn
 * there. Sample area data has none: its stops are drawn at their own distance and its amenities inside the half
 * mile they were counted in, at positions drawn from the building's id, so a sample map is the same on every
 * load. They are flagged as sample on the map, as the figures are in the Area panel. Live data without positions
 * draws no pins at all: a place is never put where nobody recorded it.
 */
export function placesAround(id: string, center: LatLng, area: Area): Place[] {
  const out: Place[] = [];
  const rnd = seeded(id);
  for (const t of area.transit) {
    const at = t.lat !== undefined && t.lng !== undefined ? { lat: t.lat, lng: t.lng } : area.sample ? offset(center, t.distanceMi, rnd() * 360) : null;
    if (at) out.push({ id: `t-${t.name}`, kind: 'transit', group: t.type, key: stopKey(t.name), name: t.name, distanceMi: t.distanceMi, ...at });
  }
  for (const p of area.places ?? []) {
    out.push({ id: `p-${p.category}-${p.name}-${p.lat}`, kind: 'amenity', group: p.category, key: categoryKey(p.category), name: p.name, distanceMi: p.distanceMi, lat: p.lat, lng: p.lng });
  }
  if (area.sample && !area.places) {
    for (const a of area.amenities) {
      for (let i = 0; i < a.count; i += 1) {
        // Even over the half-mile disc (the square root), never on the building itself.
        const d = NEAREST_MI + (WALK_MI - NEAREST_MI) * Math.sqrt(rnd());
        const at = offset(center, d, rnd() * 360);
        out.push({ id: `s-${a.category}-${i}`, kind: 'amenity', group: a.category, key: categoryKey(a.category), name: oneOf(a.category), distanceMi: Math.round(d * 10) / 10, ...at });
      }
    }
  }
  return out.sort((x, y) => x.distanceMi - y.distanceMi);
}
