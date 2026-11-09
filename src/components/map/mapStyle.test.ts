import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors } from '../../domain/derive';
import { toneFor } from '../../domain/lenses';
import { dominantTone, floorColorExpression, inflatePolygon, mixHex, normalizeHex, resolveToneHex, toneColorExpression } from './mapStyle';

describe('dominantTone', () => {
  const floors = deriveFloors(property, TODAY, TODAY);
  it('returns the tone with the most SF on each floor', () => {
    for (const f of floors) {
      const t = dominantTone(f, 'status', false);
      const sfBy = new Map<string, number>();
      for (const s of f.segments) sfBy.set(toneFor(s, 'status', false), (sfBy.get(toneFor(s, 'status', false)) ?? 0) + s.size);
      const max = Math.max(...sfBy.values());
      expect(sfBy.get(t)).toBe(max);
    }
  });
  it('breaks ties in favour of leased', () => {
    const f = floors[0];
    const half = f.leasable / 2;
    const tie = { ...f, segments: [{ ...f.segments[0], kind: 'available' as const, size: half, availableFrom: null }, { ...f.segments[0], kind: 'leased' as const, size: half, monthsToExpiry: 48 }] };
    expect(dominantTone(tie, 'status', false)).toBe('leased');
  });
  it('is leased-or-neutral under prospect-safe for at-risk suites', () => {
    const risky = floors.find((f) => f.segments.some((s) => s.kind === 'holdover' || s.kind === 'mtm'));
    if (risky) expect(dominantTone(risky, 'status', true)).not.toBe('risk');
  });
});

describe('colour helpers', () => {
  it('normalises hex forms and rejects junk', () => {
    expect(normalizeHex(' #ABC ')).toBe('#aabbcc');
    expect(normalizeHex('#e7edf3')).toBe('#e7edf3');
    expect(normalizeHex('rgb(11, 122, 102)')).toBe('#0b7a66');
    expect(normalizeHex('transparent')).toBeNull();
    expect(normalizeHex('')).toBeNull();
  });
  it('resolves tokens and falls back for transparent fills', () => {
    const vars: Record<string, string> = { '--tone-leased-fill': ' #e7edf3', '--tone-empty-fill': 'transparent' };
    const read = (n: string) => vars[n] ?? '';
    expect(resolveToneHex('leased', read)).toBe('#e7edf3');
    expect(resolveToneHex('empty', read)).toBe('#d8dde3');
    expect(resolveToneHex('nope', read)).toBe('#d8dde3');
  });
  it('mixes towards white', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#0b7a66', '#ffffff', 0)).toBe('#0b7a66');
  });
  it('builds a match expression with a fallback and a hover/selected case', () => {
    const m = toneColorExpression({ leased: '#e7edf3', available: '#0b7a66' }) as unknown[];
    expect(m[0]).toBe('match');
    expect(m).toHaveLength(2 + 4 + 1);
    expect(m[m.length - 1]).toBe('#d8dde3');
    const c = floorColorExpression({ leased: '#e7edf3' }) as unknown[];
    expect(c[0]).toBe('case');
    expect(c).toHaveLength(6);
  });
});

describe('inflatePolygon', () => {
  it('scales about the centroid and keeps the ring closed', () => {
    const sq = { type: 'Polygon' as const, coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] };
    const out = inflatePolygon(sq, 1.5);
    expect(out.coordinates[0][0]).toEqual([-0.5, -0.5]);
    expect(out.coordinates[0][2]).toEqual([2.5, 2.5]);
    expect(out.coordinates[0][4]).toEqual(out.coordinates[0][0]);
    expect(inflatePolygon(sq, 1)).toBe(sq);
  });
});
