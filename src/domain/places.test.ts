import { describe, expect, it } from 'vitest';
import { categoryKey, offset, placesAround, ringBounds, ringCoordinates, samplePositions, stopKey, WALK_MI } from './places';
import type { Area } from './types';

const center = { lat: 33.0396, lng: -96.8059 };
const area = (sample: boolean): Area => ({
  source: 'test',
  asOf: '2026-11-09',
  sample,
  rings: [],
  transit: [
    { name: 'Preston Rd @ Park Blvd', type: 'Bus', distanceMi: 0.2 },
    { name: 'Parker Road Station', type: 'Rail', distanceMi: 3.1 },
  ],
  amenities: [
    { category: 'Restaurants', count: 5 },
    { category: 'Cafés', count: 2 },
  ],
});

// Distance in miles between two points, on the same flat earth `offset` uses.
const miles = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dy = (b.lat - a.lat) * 111_320;
  const dx = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy) / 1609.344;
};

describe('places on the Map', () => {
  it('puts a point at the distance and bearing asked', () => {
    expect(miles(center, offset(center, 1, 0))).toBeCloseTo(1, 6);
    expect(offset(center, 1, 0).lat).toBeGreaterThan(center.lat);
    expect(offset(center, 1, 90).lng).toBeGreaterThan(center.lng);
  });

  it('draws a closed ring and frames it', () => {
    const ring = ringCoordinates(center, WALK_MI, 32);
    expect(ring).toHaveLength(33);
    expect(ring[0]).toEqual(ring[32]);
    const [[w, s], [e, n]] = ringBounds(center, 1);
    expect(w).toBeLessThan(center.lng);
    expect(e).toBeGreaterThan(center.lng);
    expect(s).toBeLessThan(center.lat);
    expect(n).toBeGreaterThan(center.lat);
  });

  it('places sample stops at their own distance and sample amenities inside the half mile, the same on every load', () => {
    const a = placesAround('P001', center, area(true));
    expect(a).toEqual(placesAround('P001', center, area(true)));
    expect(a).toHaveLength(2 + 5 + 2);
    const rail = a.find((p) => p.group === 'Rail')!;
    expect(miles(center, rail)).toBeCloseTo(3.1, 3);
    expect(rail.key).toBe(stopKey('Parker Road Station'));
    for (const p of a.filter((x) => x.kind === 'amenity')) {
      expect(miles(center, p)).toBeLessThanOrEqual(WALK_MI + 1e-9);
      expect(miles(center, p)).toBeGreaterThan(0.05);
      expect(p.key).toBe(categoryKey(p.group));
    }
    // Nearest first, and a different building gets its own layout.
    expect(a.map((p) => p.distanceMi)).toEqual([...a.map((p) => p.distanceMi)].sort((x, y) => x - y));
    expect(placesAround('P002', center, area(true))).not.toEqual(a);
  });

  it('never invents a position for live data: only what the source recorded is pinned', () => {
    expect(placesAround('P001', center, area(false))).toEqual([]);
    const live: Area = { ...area(false), transit: [{ name: 'Stop', type: 'Bus', distanceMi: 0.1, lat: 33.04, lng: -96.8 }], places: [{ name: 'Café Uno', category: 'Cafés', distanceMi: 0.2, lat: 33.041, lng: -96.807 }] };
    expect(placesAround('P001', center, live).map((p) => p.name)).toEqual(['Stop', 'Café Uno']);
  });
});

describe('live places with sample figures (no Census key): the positions are real, so not "Sample places" (round 25)', () => {
  it('pins the recorded positions and draws no sample ones', () => {
    const live: Area = { ...area(true), transit: [{ name: 'Stop', type: 'Bus', distanceMi: 0.1, lat: 33.04, lng: -96.8 }], places: [{ name: 'Café Uno', category: 'Cafés', distanceMi: 0.2, lat: 33.041, lng: -96.807 }] };
    expect(samplePositions(live)).toBe(false);
    expect(placesAround('P001', center, live).map((p) => p.name)).toEqual(['Stop', 'Café Uno']);
    expect(samplePositions(area(true))).toBe(true);
  });
});
