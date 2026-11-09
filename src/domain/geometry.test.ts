import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { footprint } from '../data/mock/footprint';
import { deriveFloors } from './derive';
import { extrusionFeatures, longAxisAngle, polygonArea, projectPolygon, slicePolygon, type Pt } from './geometry';

const rect: Pt[] = [
  [0, 0],
  [100, 0],
  [100, 40],
  [0, 40],
];

const rotated = (pts: Pt[], deg: number): Pt[] => {
  const a = (deg * Math.PI) / 180;
  return pts.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
};

const within = (actual: number, expected: number, pct: number) => Math.abs(actual - expected) <= expected * pct;

describe('polygonArea', () => {
  it('computes the shoelace area regardless of winding', () => {
    expect(polygonArea(rect)).toBe(4000);
    expect(polygonArea(rect.slice().reverse())).toBe(4000);
  });
});

describe('longAxisAngle', () => {
  it('follows the longest edge', () => {
    expect(longAxisAngle(rect)).toBeCloseTo(0, 6);
    const ang = longAxisAngle(rotated(rect, 30));
    expect(Math.abs(Math.abs(ang) - Math.PI / 6) < 1e-6 || Math.abs(Math.abs(ang) - (Math.PI - Math.PI / 6)) < 1e-6).toBe(true);
  });
});

describe('slicePolygon', () => {
  it('halves a rectangle into two equal strips', () => {
    const parts = slicePolygon(rect, [0.5, 0.5]);
    expect(parts).toHaveLength(2);
    for (const part of parts) {
      expect(part.length).toBeGreaterThanOrEqual(3);
      expect(within(polygonArea(part), 2000, 0.02)).toBe(true);
    }
  });
  it('splits by share', () => {
    const [a, b] = slicePolygon(rect, [0.25, 0.75]);
    expect(within(polygonArea(a), 1000, 0.02)).toBe(true);
    expect(within(polygonArea(b), 3000, 0.02)).toBe(true);
  });
  it('normalises shares that do not sum to one', () => {
    const [a, b] = slicePolygon(rect, [1, 3]);
    expect(within(polygonArea(a), 1000, 0.02)).toBe(true);
    expect(within(polygonArea(b), 3000, 0.02)).toBe(true);
  });
  it('slices along the long axis of a rotated rectangle', () => {
    const parts = slicePolygon(rotated(rect, 30), [0.5, 0.5]);
    expect(parts).toHaveLength(2);
    for (const part of parts) expect(within(polygonArea(part), 2000, 0.02)).toBe(true);
    expect(within(polygonArea(parts[0]) + polygonArea(parts[1]), 4000, 0.001)).toBe(true);
  });
  it('slices the real footprint without losing area', () => {
    const pts = projectPolygon(footprint, { w: 560, h: 420 });
    const parts = slicePolygon(pts, [0.3, 0.2, 0.5]);
    const total = parts.reduce((s, p) => s + polygonArea(p), 0);
    expect(within(total, polygonArea(pts), 0.001)).toBe(true);
    for (const p of parts) expect(p.length).toBeGreaterThanOrEqual(3);
  });
});

describe('projectPolygon', () => {
  it('fits the footprint inside the padded box', () => {
    const pts = projectPolygon(footprint, { w: 560, h: 420 });
    expect(pts.length).toBeGreaterThanOrEqual(5);
    const eps = 1e-6;
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(8 - eps);
      expect(x).toBeLessThanOrEqual(552 + eps);
      expect(y).toBeGreaterThanOrEqual(8 - eps);
      expect(y).toBeLessThanOrEqual(412 + eps);
    }
    // Touches the padding on at least one axis (fills the box).
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const fillsX = Math.min(...xs) <= 8 + eps && Math.max(...xs) >= 552 - eps;
    const fillsY = Math.min(...ys) <= 8 + eps && Math.max(...ys) >= 412 - eps;
    expect(fillsX || fillsY).toBe(true);
  });
  it('drops the closing duplicate point', () => {
    const ring = footprint.coordinates[0];
    expect(projectPolygon(footprint, { w: 100, h: 100 })).toHaveLength(ring.length - 1);
  });
});

describe('extrusionFeatures', () => {
  const floors = deriveFloors(property, TODAY, TODAY);
  const fc = extrusionFeatures(property, floors, (f) => (f.leased / f.leasable > 0.5 ? 'leased' : 'available'), property.floorHeightFt);

  it('emits one feature per floor', () => {
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(12);
    expect(fc.features.every((f) => f.type === 'Feature' && f.geometry === property.footprint)).toBe(true);
  });
  it('stacks floors in metres', () => {
    const f12 = fc.features.find((f) => f.properties.floorId === 'F12')!;
    expect(Math.abs(f12.properties.base - 11 * 13.5 * 0.3048)).toBeLessThan(0.01);
    expect(f12.properties.height - f12.properties.base).toBeCloseTo(4.1148, 4);
    expect(f12.properties.sequence).toBe(12);
    const f1 = fc.features.find((f) => f.properties.floorId === 'F1')!;
    expect(f1.properties.base).toBe(0);
  });
  it('carries tone and leased share', () => {
    const f6 = fc.features.find((f) => f.properties.floorId === 'F6')!;
    expect(f6.properties.leasedPct).toBe(1);
    expect(f6.properties.tone).toBe('leased');
    expect(f6.properties.name).toBe('Floor 6');
  });
});
