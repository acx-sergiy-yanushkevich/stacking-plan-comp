import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors } from '../../domain/derive';
import { toneFor } from '../../domain/lenses';
import { floorFact } from '../building/floorFact';
import { accentTone, dominantTone, floorState, floorColorExpression, inflatePolygon, mixHex, normalizeHex, resolveToneHex, toneColorExpression } from './mapStyle';

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

describe('floorState: what the map floor list says after the leased share', () => {
  const floors = deriveFloors(property, TODAY, TODAY);
  const say = (id: string, lens: 'status' | 'expiry' | 'rent' = 'status', safe = false) => floorState(floors.find((f) => f.floor.id === id)!, lens, safe);

  it('names the vacancy in exact SF where one word used to hide it (Floors 8 and 1)', () => {
    expect(say('F8')).toBe('7,400 SF available');
    expect(say('F1')).toBe('4,000 SF available · expires < 12 mo · 2,600 SF for sale');
    expect(say('F12')).toBe('9,300 SF available');
  });

  it('says what the Building view says of a floor at risk, whatever share of the floor it is', () => {
    // Floor 2: 6,200 SF month-to-month on a floor that is mostly plain leased. Floor 1: the café, expiring Feb '27.
    expect(say('F2')).toBe('Month-to-month · 5,400 SF unaccounted');
    expect(say('F1')).toContain('expires < 12 mo');
    expect(say('F3')).toBe('5,500 SF available · holdover');
    expect(say('F6')).toBe('Expires < 12 mo');
    expect(say('F10')).toBe('');
  });

  it('agrees with the Building view on every floor, in every lens, prospect-safe or not', () => {
    for (const lens of ['status', 'expiry', 'deals', 'rent'] as const)
      for (const safe of [false, true])
        for (const f of floors) {
          const building = floorFact(f, lens, safe);
          const map = floorState(f, lens, safe);
          // Every part of the Building view's fact is on the map's row, word for word. A sublease-only
          // floor's space is the one difference: the map says "sublease available" where the model says "available".
          for (const part of building.split(' · ').filter(Boolean)) {
            const there = map.toLowerCase().includes(part.toLowerCase()) || (/ SF available$/.test(part) && map.includes(part.replace(' SF available', ' SF sublease available')));
            expect(there, `${f.floor.name}, ${lens}${safe ? ', safe' : ''}: "${part}" is not in "${map}"`).toBe(true);
          }
        }
  });

  it('says a sublease is a sublease, and names an area with no record', () => {
    expect(say('F7')).toBe('7,000 SF sublease available');
    expect(say('F2')).toContain('5,400 SF unaccounted');
  });

  it('prospect-safe: no risk or expiry word, and a gap is space that is not on the market', () => {
    expect(say('F3', 'status', true)).toBe('5,500 SF available');
    expect(say('F6', 'status', true)).toBe('');
    expect(say('F2', 'status', true)).toBe('5,400 SF not on the market');
    for (const lens of ['status', 'expiry', 'rent'] as const)
      for (const f of floors) expect(floorState(f, lens, true), `${f.floor.name}, ${lens}`).not.toMatch(/risk|expir|holdover|month-to-month|MTM|unaccounted|live deal/i);
  });

  it('gives the swatch a second colour for a holdover, month-to-month or soon-expiring lease, never in prospect-safe mode', () => {
    const tone = (id: string, lens: 'status' | 'expiry' = 'status', safe = false) => accentTone(floors.find((f) => f.floor.id === id)!, lens, safe);
    expect(tone('F2')).toBe('risk');
    expect(tone('F1')).toBe('expiring');
    expect(tone('F10')).toBeNull();
    expect(tone('F2', 'expiry')).toBe('risk');
    for (const f of floors) for (const lens of ['status', 'expiry'] as const) expect(accentTone(f, lens, true), `${f.floor.name}, ${lens}`).toBeNull();
  });

  it('in the other lenses the band that colours the floor leads, then the space on offer', () => {
    expect(say('F8', 'expiry')).toMatch(/ · 7,400 SF available$/);
    expect(say('F8', 'expiry').split(' · ')[0].length).toBeGreaterThan(0);
  });
});
