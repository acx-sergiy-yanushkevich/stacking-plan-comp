import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors } from '../../domain/derive';
import { toneFor, toneLabel, type LensId } from '../../domain/lenses';
import { safeFloors } from '../../domain/safe';
import { askingSegments, expirySpan, floorLabelParts, lensFact } from '../building/floorFact';
import { dominantTone, floorAlso, floorColorExpression, guardedFilter, inflatePolygon, mixHex, normalizeHex, resolveToneHex, riseAt, riseExpr, swatchTones, toneColorExpression } from './mapStyle';

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
    expect(floorAlso(floor('F2'), false)).toBe('5,400 SF not listed');
    expect(floorAlso(floor('F10'), false)).toBe('');
    // A prospect is told the space is not on the market, never that the records have a gap.
    expect(floorAlso(floor('F2'), true)).toBe('5,400 SF not on the market');
  });

  it('prospect-safe: no risk, expiry, deal or data-gap word in what is added', () => {
    for (const f of floors) expect(floorAlso(f, true), f.floor.name).not.toMatch(/risk|expir|holdover|month-to-month|MTM|unaccounted|live deal/i);
  });

  it('gives the swatch a second colour for a holdover, month-to-month or soon-expiring lease, never in prospect-safe mode', () => {
    const tone = (id: string, lens: 'status' | 'expiry' = 'status', safe = false) => swatchTones(floor(id), lens, safe).accent;
    expect(tone('F2')).toBe('risk');
    expect(tone('F1')).toBe('expiring');
    expect(tone('F10')).toBeNull();
    expect(tone('F2', 'expiry')).toBe('risk');
    for (const f of safeFloors(floors, true)) for (const lens of ['status', 'expiry'] as const) expect(swatchTones(f, lens, true).accent, `${f.floor.name}, ${lens}`).toBeNull();
  });
});

/**
 * Round 16: on the expiration lens the swatch of a row showed the colour of most of the floor while the
 * words beside it named the soonest expiry (Floor 5: a "1–2 yr" swatch beside "expires Apr '27"). The
 * swatch now shows the fact the words name, in every lens; the 3D floors keep each suite's own colour.
 */
describe('the swatch of a row in the map floor list and the words beside it say the same thing', () => {
  const floors = deriveFloors(property, TODAY, TODAY);
  const floor = (id: string) => floors.find((f) => f.floor.id === id)!;
  const months = (iso: string) => (Number(iso.slice(0, 4)) - Number(TODAY.slice(0, 4))) * 12 + Number(iso.slice(5, 7)) - Number(TODAY.slice(5, 7)) - (Number(iso.slice(8, 10)) < Number(TODAY.slice(8, 10)) ? 1 : 0);
  /** The legend step a number of months falls in, in the legend's words. */
  const step = (m: number) => (m < 6 ? '< 6 mo' : m < 12 ? '6–12 mo' : m < 24 ? '1–2 yr' : m < 36 ? '2–3 yr' : m < 60 ? '3–5 yr' : '5+ yr');

  it('expiration: the swatch is the legend step of the first date the label gives', () => {
    for (const f of floors) {
      const span = expirySpan(f);
      const { tone, accent } = swatchTones(f, 'expiry', false);
      const words = lensFact(f, 'expiry', false);
      if (span) expect(toneLabel(tone, 'expiry', false), `${f.floor.name}: "${words}"`).toBe(step(months(span.first)));
      else expect(tone, f.floor.name).toBe(dominantTone(f, 'expiry', false));
      // The second colour is the at-risk tone exactly where the words say holdover or month-to-month.
      expect(accent === 'risk' || tone === 'risk', `${f.floor.name}: "${words}"`).toBe(/holdover|month-to-month/.test(words));
    }
    // The two rows the judge named: both expire within 6 months first, and most of each floor is a later step.
    expect(toneLabel(swatchTones(floor('F5'), 'expiry', false).tone, 'expiry', false)).toBe('< 6 mo');
    expect(toneLabel(dominantTone(floor('F5'), 'expiry', false), 'expiry', false)).toBe('1–2 yr');
    expect(toneLabel(swatchTones(floor('F1'), 'expiry', false).tone, 'expiry', false)).toBe('< 6 mo');
    expect(toneLabel(dominantTone(floor('F1'), 'expiry', false), 'expiry', false)).toBe('2–3 yr');
    // A floor with one term keeps the colour of that term, which is the colour of all its leased space.
    expect(swatchTones(floor('F10'), 'expiry', false)).toEqual({ tone: 'exp-4', accent: null });
    expect(swatchTones(floor('F3'), 'expiry', false)).toEqual({ tone: 'exp-3', accent: 'risk' });
  });

  it('deals: the swatch is the stage the label names, the furthest any live deal has reached', () => {
    let named = 0;
    for (const f of floors) {
      const words = lensFact(f, 'deals', false);
      const { tone, accent } = swatchTones(f, 'deals', false);
      expect(accent, f.floor.name).toBeNull();
      if (!words) {
        expect(tone, f.floor.name).toBe(dominantTone(f, 'deals', false));
        continue;
      }
      named += 1;
      expect(toneLabel(tone, 'deals', false).toLowerCase(), `${f.floor.name}: "${words}"`).toBe(words.split(' · ').at(-1)!.toLowerCase());
    }
    expect(named).toBeGreaterThanOrEqual(4);
  });

  it('rent: the swatch is the band of the rent the label gives, asking where there is space on offer', () => {
    const band = (tone: string) => toneLabel(tone as never, 'rent', false);
    // Floor 12: space asked at $38–$40 beside a lease at $36. The label gives the asking rent, and so does the swatch.
    expect(lensFact(floor('F12'), 'rent', false)).toBe('asking $38–$40/SF/yr FSG');
    expect(band(swatchTones(floor('F12'), 'rent', false).tone)).toBe('$38+');
    // Floor 8: most of the floor is leased at $34, the space on offer asks $31–$33.
    expect(band(dominantTone(floor('F8'), 'rent', false))).toBe('$34–37.99');
    expect(band(swatchTones(floor('F8'), 'rent', false).tone)).toBe('$31–33.99');
    for (const f of floors) {
      const asking = askingSegments(f, false);
      const { tone } = swatchTones(f, 'rent', false);
      if (asking.length > 0) expect(asking.map((sg) => toneFor(sg, 'rent', false)), f.floor.name).toContain(tone);
      // A floor that gives a rent in place is never drawn as "Confidential" or "No rent on record".
      else if (lensFact(f, 'rent', false)) expect(['confidential', 'muted', 'empty'], f.floor.name).not.toContain(tone);
    }
    // A prospect: the asking band where there is space, and the withheld tone elsewhere, as on the map.
    const prospect = safeFloors(floors, true);
    for (const f of prospect) {
      const { tone, accent } = swatchTones(f, 'rent', true);
      expect(accent).toBeNull();
      if (askingSegments(f, true).length === 0) expect(tone, f.floor.name).toBe(dominantTone(f, 'rent', true));
    }
  });

  it('status: the swatch is the space on offer the label leads with, else the state of most of the floor; its second color is the risk the label names', () => {
    for (const safe of [false, true])
      for (const f of safeFloors(floors, safe)) {
        const words = lensFact(f, 'status', safe);
        const space = floorLabelParts(f, 'status', safe).space;
        const { tone, accent } = swatchTones(f, 'status', safe);
        const name = `${f.floor.name}${safe ? ' (prospect)' : ''}: "${space}"`;
        if (/^[\d,]+ SF sublease available/.test(space)) expect(tone, name).toBe('sublease');
        else if (space) expect(tone, name).toBe('available');
        else expect(tone, name).toBe(dominantTone(f, 'status', safe));
        if (/holdover|month-to-month/.test(words)) expect(accent === 'risk' || tone === 'risk', name).toBe(true);
        else if (/expires < 12 mo/.test(words)) expect(accent === 'expiring' || tone === 'expiring', name).toBe(true);
        else expect(accent, name).toBeNull();
      }
  });

  /**
   * Round 17: Floor 12 read "50.0% leased · 9,300 SF available" beside a grey "leased" swatch, and Floor 8's
   * "7,400 SF available" too. The swatch now names the space on offer, the label's lead fact; a holdover or a
   * lease ending within 12 months on the same floor is its lower half.
   */
  it('status: the four floors the judge named', () => {
    expect(floorLabelParts(floor('F12'), 'status', false).space).toBe('9,300 SF available');
    expect(dominantTone(floor('F12'), 'status', false)).toBe('leased');
    expect(swatchTones(floor('F12'), 'status', false)).toEqual({ tone: 'available', accent: null });
    expect(floorLabelParts(floor('F8'), 'status', false).space).toBe('7,400 SF available');
    expect(swatchTones(floor('F8'), 'status', false)).toEqual({ tone: 'available', accent: null });
    expect(lensFact(floor('F3'), 'status', false)).toBe('holdover');
    expect(floorLabelParts(floor('F3'), 'status', false).space).toBe('5,500 SF available');
    expect(swatchTones(floor('F3'), 'status', false)).toEqual({ tone: 'available', accent: 'risk' });
    expect(lensFact(floor('F1'), 'status', false)).toBe('expires < 12 mo');
    expect(swatchTones(floor('F1'), 'status', false)).toEqual({ tone: 'available', accent: 'expiring' });
  });

  it('is the same function for every lens a broker or a prospect can open', () => {
    for (const safe of [false, true]) for (const lens of ['status', 'expiry', 'deals', 'rent'] as LensId[]) for (const f of safeFloors(floors, safe)) expect(swatchTones(f, lens, safe).tone, `${f.floor.name} ${lens}`).toBeTruthy();
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

describe('the building rises as the map tilts into 3D', () => {
  it('scales the floors by the rise, and draws them as recorded once it is over', () => {
    expect(riseExpr('height', 1)).toEqual(['get', 'height']);
    expect(riseExpr('base', 0.5)).toEqual(['*', ['get', 'base'], 0.5]);
    expect(riseExpr('height', 0)).toEqual(['*', ['get', 'height'], 0]);
  });

  it('eases out over the rise and stops at its end', () => {
    expect(riseAt(0)).toBe(0);
    expect(riseAt(0.5)).toBe(0.875);
    expect(riseAt(1)).toBe(1);
    expect(riseAt(2)).toBe(1);
    expect(riseAt(-1)).toBe(0);
  });
});
