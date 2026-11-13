import type { Area, GeoPolygon, Property } from '../../domain/types';
import { oneOf } from '../../domain/places';
import { bestBackup, keepBackup } from './placesBackup';
import type { AreaOptions, DataSource, FootprintResult } from './DataSource';
import { CensusSource } from './CensusSource';
import { MockSource } from './MockSource';

export const OVERPASS_ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const TIMEOUT_MS = 12_000;
const FOOTPRINT_RADIUS_M = 120;
/** Amenities and bus stops are looked for within half a mile: the walk the map shades. */
const NEARBY_RADIUS_M = 800;
/**
 * Rail out to the widest ring, five miles: a station three miles out is part of the commute the 5-mile ring is there
 * to show (round 25: live mode asked within half a mile and dropped the DART stations the sample listed).
 */
const RAIL_RADIUS_M = 8047;
/** The nearest of each kind, so a street of bus stops never pushes the rail stations off the list. */
const BUS_STOPS = 4;
const RAIL_STOPS = 3;
const METRES_PER_MILE = 1609.34;

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  /** Present on ways fetched with `out geom`. */
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
  /** When the data was last brought up to date (`timestamp_osm_base`, ISO): a kept copy is dated by it. */
  osm3s?: { timestamp_osm_base?: string };
}

/** Approximate ground distance in metres (equirectangular; fine under a few km). */
export function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = dLng * Math.cos(((a.lat + b.lat) / 2 * Math.PI) / 180);
  return R * Math.sqrt(x * x + dLat * dLat);
}

function centroid(points: Array<{ lat: number; lon: number }>): { lat: number; lng: number } {
  const n = points.length;
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.lat;
    lng += p.lon;
  }
  return { lat: lat / n, lng: lng / n };
}

/**
 * The building way whose centroid is nearest the centre, as a closed GeoJSON polygon ring
 * (`[lng, lat]`). Null when no way with three or more vertices is present.
 */
export function toPolygon(elements: OverpassElement[], center: { lat: number; lng: number }): GeoPolygon | null {
  let best: OverpassElement | null = null;
  let bestDist = Infinity;
  for (const el of elements) {
    if (el.type !== 'way' || !el.geometry) continue;
    const pts = el.geometry;
    const open = pts.length > 1 && pts[0].lat === pts[pts.length - 1].lat && pts[0].lon === pts[pts.length - 1].lon ? pts.slice(0, -1) : pts;
    if (open.length < 3) continue;
    const d = metres(centroid(open), center);
    if (d < bestDist) {
      bestDist = d;
      best = el;
    }
  }
  if (!best || !best.geometry) return null;
  const ring = best.geometry.map((p) => [p.lon, p.lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  return { type: 'Polygon', coordinates: [ring] };
}

/** POST an Overpass QL query, trying each endpoint in order with a per-request timeout. */
export async function queryOverpass(ql: string, endpoints: string[] = OVERPASS_ENDPOINTS): Promise<OverpassElement[]> {
  return (await queryOverpassDated(ql, endpoints)).elements;
}

/** The same, with the day OpenStreetMap's data is as of (null when the answer does not say). */
export async function queryOverpassDated(ql: string, endpoints: string[] = OVERPASS_ENDPOINTS): Promise<{ elements: OverpassElement[]; at: string | null }> {
  let lastError: unknown = null;
  for (const url of endpoints) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(ql)}`,
        signal: ctl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as OverpassResponse;
      return { elements: data.elements ?? [], at: data.osm3s?.timestamp_osm_base?.slice(0, 10) ?? null };
    } catch (e) {
      lastError = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Overpass unavailable');
}

export const footprintQuery = (c: { lat: number; lng: number }) =>
  `[out:json][timeout:25];(way["building"](around:${FOOTPRINT_RADIUS_M},${c.lat},${c.lng}););out geom tags;`;

export const nearbyQuery = (c: { lat: number; lng: number }) =>
  `[out:json][timeout:25];(` +
  `node["railway"~"^(station|halt|tram_stop)$"](around:${RAIL_RADIUS_M},${c.lat},${c.lng});` +
  `node["public_transport"="station"](around:${NEARBY_RADIUS_M},${c.lat},${c.lng});` +
  `node["highway"="bus_stop"](around:${NEARBY_RADIUS_M},${c.lat},${c.lng});` +
  `node["amenity"~"^(restaurant|cafe|bank|gym|fitness_centre|parking)$"](around:${NEARBY_RADIUS_M},${c.lat},${c.lng});` +
  `node["tourism"="hotel"](around:${NEARBY_RADIUS_M},${c.lat},${c.lng});` +
  `);out tags center;`;

const AMENITY_LABEL: Record<string, string> = {
  restaurant: 'Restaurants',
  cafe: 'Cafés',
  bank: 'Banks',
  gym: 'Fitness',
  fitness_centre: 'Fitness',
  parking: 'Parking',
  hotel: 'Hotels',
};

/**
 * A stop's kind from its tags: rail when it says so. A bus station is a `public_transport` station too, and a stop
 * buses share with a trolley is a bus stop and a rail platform at once: rail, when trains or trams call there
 * (round 26: Uptown's M-Line stops read "Bus").
 */
const RAIL_MODES = ['train', 'light_rail', 'subway', 'tram'];
const isRailStop = (tags: Record<string, string>) =>
  ['station', 'halt', 'tram_stop'].includes(tags.railway ?? '') ||
  ((tags.public_transport === 'station' || tags.public_transport === 'platform' || tags.railway === 'platform') && RAIL_MODES.some((m) => tags[m] === 'yes'));

/** A name that names: a stop tagged only "1" or "2" (a stop's number in its pole order) is treated as unnamed (round 26). */
const named = (name: string | undefined) => (name && !/^\s*\d+\s*$/.test(name) ? name : undefined);

/** Nearest first; at the same distance rail before bus, and stops of one kind as they came (a valid order: round 26). */
const nearestFirst = (a: { distanceMi: number; type: string }, b: { distanceMi: number; type: string }) =>
  a.distanceMi - b.distanceMi || (a.type === b.type ? 0 : a.type === 'Rail' ? -1 : 1);

/** What live mode lays over the figures: the stops and places, and the copy's date when they are a copy. */
type Nearby = Pick<Area, 'transit' | 'amenities' | 'places' | 'placesRecordedAt'>;

/**
 * Transit stops and amenities from the nodes the query returns: the counts the Area panel ranks, and each stop's and
 * place's own position and name, which the Map pins where they are (round 25: live mode kept the counts and dropped
 * the positions, so its map had no pins). Distances stay unrounded: "< 0.1 mi" is decided on the real figure.
 * Null when nothing came back.
 */
export function toNearby(elements: OverpassElement[], center: { lat: number; lng: number }): Pick<Area, 'transit' | 'amenities' | 'places'> | null {
  const transit: Area['transit'] = [];
  const counts = new Map<string, number>();
  const places: NonNullable<Area['places']> = [];
  const miles = (lat: number, lng: number) => metres({ lat, lng }, center) / METRES_PER_MILE;
  for (const el of elements) {
    const tags = el.tags ?? {};
    const lat = el.lat;
    const lng = el.lon;
    const isRail = isRailStop(tags);
    const isBus = !isRail && (tags.highway === 'bus_stop' || tags.public_transport === 'station');
    if ((isRail || isBus) && lat !== undefined && lng !== undefined) {
      transit.push({ name: named(tags.name) ?? (isRail ? 'Station' : 'Bus stop'), type: isRail ? 'Rail' : 'Bus', distanceMi: miles(lat, lng), lat, lng });
      continue;
    }
    const cat = AMENITY_LABEL[tags.amenity ?? ''] ?? (tags.tourism === 'hotel' ? AMENITY_LABEL.hotel : null);
    if (!cat) continue;
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
    if (lat !== undefined && lng !== undefined) places.push({ name: named(tags.name) ?? oneOf(cat), category: cat, distanceMi: miles(lat, lng), lat, lng });
  }
  if (transit.length === 0 && counts.size === 0) return null;
  const seen = new Set<string>();
  const dedup = transit
    .sort(nearestFirst)
    .filter((t) => (seen.has(t.name) ? false : (seen.add(t.name), true)));
  const nearest = [...dedup.filter((t) => t.type === 'Bus').slice(0, BUS_STOPS), ...dedup.filter((t) => t.type === 'Rail').slice(0, RAIL_STOPS)].sort(nearestFirst);
  return { transit: nearest, amenities: [...counts].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count), places: places.sort((a, b) => a.distanceMi - b.distanceMi) };
}

/**
 * OpenStreetMap via Overpass: the nearest building way as the footprint, nearby stops and
 * amenities for the Area panel; demographics are delegated to the Census source. Every
 * failure falls back to the mock so the view never breaks on a rate-limited endpoint.
 */
export class OverpassSource implements DataSource {
  private readonly census: CensusSource;
  private readonly fallback: DataSource;
  private readonly endpoints: string[];

  constructor(census: CensusSource = new CensusSource(), fallback: DataSource = new MockSource(), endpoints: string[] = OVERPASS_ENDPOINTS) {
    this.census = census;
    this.fallback = fallback;
    this.endpoints = endpoints;
  }

  async getFootprint(p: Property): Promise<FootprintResult> {
    try {
      const elements = await queryOverpass(footprintQuery(p.location), this.endpoints);
      const polygon = toPolygon(elements, p.location);
      if (polygon) return { polygon, source: 'osm' };
    } catch {
      // fall through to the cached footprint
    }
    return this.fallback.getFootprint(p);
  }

  async getArea(p: Property, opts?: AreaOptions): Promise<Area> {
    const [area, nearby] = await Promise.all([
      this.census.getArea(p, opts),
      queryOverpass(nearbyQuery(p.location), this.endpoints)
        .then((els) => toNearby(els, p.location))
        .catch(() => null),
    ]);
    return nearby ? { ...area, transit: nearby.transit, amenities: nearby.amenities, places: nearby.places } : area;
  }

  /**
   * The area at once, then fresher (round 26: a demo waited up to 36 s on the shared servers before the map had a
   * pin, and they often refuse outright). First, together: the figures the Census source gives without waiting (the
   * sample, without a key) and the stops and places of the best copy on hand, the last live answer this browser
   * kept or the one recorded with the app, so the map never draws sample pins first. Then, each as it comes:
   * OpenStreetMap's own answer, kept for the next visit, and the Census's figures when a key is given. A copy says
   * its date (`placesRecordedAt`) until a live answer replaces it.
   */
  watchArea(p: Property, opts: AreaOptions | undefined, onArea: (area: Area) => void): () => void {
    let alive = true;
    let ready = false;
    let live = false;
    let figures: Area | null = null;
    let places: Nearby | null = null;
    const emit = () => {
      if (alive && ready && figures) onArea(places ? { ...figures, ...places } : figures);
    };
    void Promise.all([this.fallback.getArea(p, opts), bestBackup(p.id)]).then(([sample, copy]) => {
      figures ??= { ...sample, sample: true };
      const copied = copy && !live ? toNearby(copy.elements, p.location) : null;
      if (copied) places = { ...copied, placesRecordedAt: copy!.recordedAt };
      ready = true;
      emit();
    });
    void this.census.getArea(p, opts).then((a) => {
      figures = a;
      emit();
    });
    void queryOverpassDated(nearbyQuery(p.location), this.endpoints)
      .then(({ elements, at }) => {
        const fresh = toNearby(elements, p.location);
        if (!fresh) return;
        live = true;
        places = fresh;
        if (at) keepBackup(p.id, { recordedAt: at, elements });
        emit();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }
}
