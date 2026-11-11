import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors } from '../../domain/derive';
import { toneFor } from '../../domain/lenses';
import { accentTone, dominantTone, floorAlso, floorColorExpression, guardedFilter, inflatePolygon, mixHex, normalizeHex, resolveToneHex, toneColorExpression } from './mapStyle';

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

describe('what the map floor list adds to a floor\'s label', () => {
  const floors = deriveFloors(property, TODAY, TODAY);
  const floor = (id: string) => floors.find((f) => f.floor.id === id)!;

  it('keeps what the label does not say in the tooltip and the accessible name, in exact SF', () => {
    // The label itself says when the space on offer is a sublease (building/floorFact.ts), so that is not repeated here.
    expect(floorAlso(floor('F7'), false)).toBe('');
    expect(floorAlso(floor('F1'), false)).toBe('2,600 SF for sale');
    expect(floorAlso(floor('F2'), false)).toBe('5,400 SF unaccounted');
    expect(floorAlso(floor('F10'), false)).toBe('');
    // A prospect is told the space is not on the market, never that the records have a gap.
    expect(floorAlso(floor('F2'), true)).toBe('5,400 SF not on the market');
  });

  it('prospect-safe: no risk, expiry, deal or data-gap word in what is added', () => {
    for (const f of floors) expect(floorAlso(f, true), f.floor.name).not.toMatch(/risk|expir|holdover|month-to-month|MTM|unaccounted|live deal/i);
  });

  it('gives the swatch a second colour for a holdover, month-to-month or soon-expiring lease, never in prospect-safe mode', () => {
    const tone = (id: string, lens: 'status' | 'expiry' = 'status', safe = false) => accentTone(floor(id), lens, safe);
    expect(tone('F2')).toBe('risk');
    expect(tone('F1')).toBe('expiring');
    expect(tone('F10')).toBeNull();
    expect(tone('F2', 'expiry')).toBe('risk');
    for (const f of floors) for (const lens of ['status', 'expiry'] as const) expect(accentTone(f, lens, true), `${f.floor.name}, ${lens}`).toBeNull();
  });
});

describe('guardedFilter: a basemap filter that compares a property some features lack', () => {
  it('gives an ordered comparison on a property a fallback that fails it, so the same features are left out without an error', () => {
    const shields = ['all', ['<=', ['get', 'ref_length'], 6], ['match', ['get', 'network'], ['us-interstate'], true, false]];
    expect(guardedFilter(shields)).toEqual(['all', ['<=', ['coalesce', ['get', 'ref_length'], Number.MAX_SAFE_INTEGER], 6], ['match', ['get', 'network'], ['us-interstate'], true, false]]);
    expect(guardedFilter(['>=', ['get', 'rank'], 3])).toEqual(['>=', ['coalesce', ['get', 'rank'], -Number.MAX_SAFE_INTEGER], 3]);
    // A feature that has the property is judged as before: the fallback is only reached without it.
    expect(JSON.stringify(guardedFilter(shields))).toContain('["get","ref_length"]');
  });

  it('returns the very same filter when there is nothing to guard, so the caller sets nothing', () => {
    const plain = ['all', ['==', ['get', 'class'], 'country'], ['!=', ['get', 'maritime'], 1]];
    expect(guardedFilter(plain)).toBe(plain);
    const legacy = ['==', 'class', 'park'];
    expect(guardedFilter(legacy)).toBe(legacy);
    expect(guardedFilter(undefined)).toBeUndefined();
  });
});
