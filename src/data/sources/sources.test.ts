import { describe, expect, it } from 'vitest';
import { aggregate, parseAcs, type CensusRow } from './CensusSource';
import { toNearby, toPolygon, type OverpassElement } from './OverpassSource';
import { createDataSource, MockSource } from './index';
import { property } from '../mock/property';

const sq = (lat: number, lon: number, s = 0.0002): OverpassElement['geometry'] => [
  { lat, lon },
  { lat, lon: lon + s },
  { lat: lat + s, lon: lon + s },
  { lat: lat + s, lon },
  { lat, lon },
];

describe('toPolygon', () => {
  const center = { lat: 33.0235, lng: -96.7936 };
  it('picks the way whose centroid is nearest the centre', () => {
    const far: OverpassElement = { type: 'way', id: 1, geometry: sq(33.0245, -96.7950), tags: { building: 'yes' } };
    const near: OverpassElement = { type: 'way', id: 2, geometry: sq(33.0234, -96.7937), tags: { building: 'office' } };
    const poly = toPolygon([far, near], center);
    expect(poly).not.toBeNull();
    expect(poly!.coordinates[0][0]).toEqual([-96.7937, 33.0234]);
  });
  it('closes an open ring and emits [lng, lat]', () => {
    const open: OverpassElement = { type: 'way', id: 3, geometry: sq(33.0234, -96.7937)!.slice(0, 4) };
    const poly = toPolygon([open], center)!;
    const ring = poly.coordinates[0];
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
    expect(ring[1]).toEqual([-96.7935, 33.0234]);
  });
  it('ignores nodes and degenerate ways', () => {
    const node: OverpassElement = { type: 'node', id: 4, lat: 33.0235, lon: -96.7936 };
    const line: OverpassElement = { type: 'way', id: 5, geometry: [{ lat: 33, lon: -96 }, { lat: 33.1, lon: -96 }] };
    expect(toPolygon([node, line], center)).toBeNull();
  });
});

describe('aggregate', () => {
  const row = (o: Partial<CensusRow>): CensusRow => ({
    geoid: '48085031000',
    population: null,
    medianIncome: null,
    medianAge: null,
    households: null,
    bachelors: null,
    eduTotal: null,
    commuteMinutes: null,
    commuters: null,
    ...o,
  });
  it('sums totals and weights medians by households (income) and population (age)', () => {
    const a = row({ population: 1000, households: 400, medianIncome: 100000, medianAge: 30, bachelors: 300, eduTotal: 600, commuteMinutes: 12000, commuters: 500 });
    const b = row({ population: 3000, households: 100, medianIncome: 50000, medianAge: 40, bachelors: 100, eduTotal: 400, commuteMinutes: 18000, commuters: 1000 });
    const r = aggregate([a, b]);
    expect(r.population).toBe(4000);
    expect(r.households).toBe(500);
    expect(r.medianIncome).toBe(90000); // (100k×400 + 50k×100) / 500
    expect(r.medianAge).toBe(37.5); // (30×1000 + 40×3000) / 4000
    expect(r.bachelorsPct).toBeCloseTo(0.4); // 400 / 1000
    expect(r.meanCommuteMin).toBe(20); // 30000 / 1500
  });
  it('skips negative sentinels and nulls', () => {
    const good = row({ population: 2000, households: 800, medianIncome: 80000, medianAge: 35 });
    const suppressed = row({ population: 500, households: 200, medianIncome: -666666666, medianAge: -666666666 });
    const empty = row({});
    const r = aggregate([good, suppressed, empty]);
    expect(r.population).toBe(2500);
    expect(r.households).toBe(1000);
    expect(r.medianIncome).toBe(80000);
    expect(r.medianAge).toBe(35);
    expect(r.bachelorsPct).toBe(0);
    expect(r.meanCommuteMin).toBe(0);
  });
  it('parses the ACS table by header name and builds the 11-digit GEOID', () => {
    const rows = parseAcs([
      ['B01003_001E', 'B19013_001E', 'B01002_001E', 'B11001_001E', 'B15003_022E', 'B15003_001E', 'B08013_001E', 'B08012_001E', 'state', 'county', 'tract'],
      ['4123', '98000', '36.5', '1800', '900', '2900', '41000', '1900', '48', '085', '031701'],
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].geoid).toBe('48085031701');
    expect(rows[0].population).toBe(4123);
    expect(rows[0].medianAge).toBe(36.5);
  });
});

describe('toNearby', () => {
  it('counts amenities by category and lists stops by distance', () => {
    const c = { lat: 33.0235, lng: -96.7936 };
    const els: OverpassElement[] = [
      { type: 'node', id: 1, lat: 33.0245, lon: -96.7936, tags: { highway: 'bus_stop', name: 'Park Blvd' } },
      { type: 'node', id: 2, lat: 33.0236, lon: -96.7936, tags: { railway: 'station', name: 'Central' } },
      { type: 'node', id: 3, lat: 33.0236, lon: -96.7930, tags: { amenity: 'cafe' } },
      { type: 'node', id: 4, lat: 33.0237, lon: -96.7930, tags: { amenity: 'cafe' } },
      { type: 'node', id: 5, lat: 33.0237, lon: -96.7931, tags: { amenity: 'restaurant' } },
    ];
    const n = toNearby(els, c)!;
    expect(n.transit.map((t) => t.name)).toEqual(['Central', 'Park Blvd']);
    expect(n.transit[0].type).toBe('Rail');
    expect(n.amenities).toEqual([
      { category: 'Cafés', count: 2 },
      { category: 'Restaurants', count: 1 },
    ]);
  });
  it('returns null when nothing matched', () => {
    expect(toNearby([], { lat: 0, lng: 0 })).toBeNull();
  });

  it('keeps each stop and place where it is, with its own name, so the Map pins them there (round 25)', () => {
    const c = { lat: 33.0235, lng: -96.7936 };
    const els: OverpassElement[] = [
      { type: 'node', id: 1, lat: 33.0245, lon: -96.7936, tags: { highway: 'bus_stop', name: 'Park Blvd' } },
      { type: 'node', id: 3, lat: 33.0236, lon: -96.793, tags: { amenity: 'cafe', name: 'Corner Café' } },
      { type: 'node', id: 4, lat: 33.0265, lon: -96.793, tags: { amenity: 'cafe' } },
    ];
    const n = toNearby(els, c)!;
    expect(n.transit[0]).toMatchObject({ name: 'Park Blvd', lat: 33.0245, lng: -96.7936 });
    // Nearest first; a place with no name on record is named for its kind, never given an invented name.
    expect(n.places!.map((p) => [p.name, p.category, p.lat, p.lng])).toEqual([
      ['Corner Café', 'Cafés', 33.0236, -96.793],
      ['Café', 'Cafés', 33.0265, -96.793],
    ]);
  });
});

describe('createDataSource', () => {
  it('returns the mock when not live', async () => {
    const ds = createDataSource(false, null);
    expect(ds).toBeInstanceOf(MockSource);
    const fp = await ds.getFootprint(property);
    expect(fp.source).toBe(property.footprintSource);
    expect(fp.polygon).toBe(property.footprint);
    expect((await ds.getArea(property)).sample).toBe(true);
  });
});
