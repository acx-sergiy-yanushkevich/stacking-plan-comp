import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors, type FloorView } from '../domain/derive';
import { computeKpis } from '../domain/kpis';
import { readQuery } from '../domain/query';
import { publishedFloors, safeFloors, safeKpis } from '../domain/safe';
import { floorWords, search } from './usePlanModel';

/** The floors and KPIs the plan draws, as `usePlanModel` derives them. */
function plan(safe: boolean) {
  const totals = publishedFloors(deriveFloors(property, TODAY, TODAY), safe);
  return { floors: safeFloors(totals, safe), kpis: safeKpis(computeKpis(property, totals, TODAY), safe) };
}

const run = (floors: FloorView[], q: string, safe: boolean) => search(floors, q, safe, readQuery(q, TODAY));
const litSf = (floors: FloorView[], keys: Iterable<string>) => {
  const want = new Set(keys);
  return floors.flatMap((f) => f.segments).filter((s) => want.has(s.key)).reduce((t, s) => t + s.size, 0);
};

describe('a state word in the search box (round 23)', () => {
  it('"available" and "vacant" light the SF the Available KPI reports: direct and sublease', () => {
    for (const safe of [false, true]) {
      const { floors, kpis } = plan(safe);
      for (const q of ['available', 'vacant', 'available space']) {
        expect(litSf(floors, run(floors, q, safe).keys()), `${q}${safe ? ' (safe)' : ''}`).toBe(kpis.availableDirect + kpis.availableSublease);
      }
    }
    expect(plan(false).kpis.availableDirect + plan(false).kpis.availableSublease).toBe(33200);
  });

  it('after time travel too: space available later is not in the KPI, so it is not lit', () => {
    const asOf = '2027-06-01';
    const floors = deriveFloors(property, asOf, TODAY);
    const kpis = computeKpis(property, floors, asOf);
    expect(litSf(floors, search(floors, 'available', false, readQuery('available', asOf)).keys())).toBe(kpis.availableDirect + kpis.availableSublease);
  });

  it('"subleases on floor 7" lights the sublease on Floor 7 and nothing else', () => {
    const { floors } = plan(false);
    const hits = run(floors, 'subleases on floor 7', false);
    expect(hits.size).toBeGreaterThan(0);
    for (const key of hits.keys()) {
      const f = floors.find((x) => x.segments.some((s) => s.key === key))!;
      expect(f.floor.name).toBe('Floor 7');
      expect(f.segments.find((s) => s.key === key)!.kind).toBe('sublease');
    }
    expect([...hits.values()][0]).toBe('Sublease on Floor 7');
  });
});

describe('floor and largest-block phrases (round 31)', () => {
  it('"12 floor", "12th floor" and "floor 12" light the same floor', () => {
    const { floors } = plan(false);
    const a = [...run(floors, 'floor 7', false).keys()].sort();
    expect(a.length).toBeGreaterThan(0);
    for (const q of ['7 floor', '7th floor', 'fl 7']) expect([...run(floors, q, false).keys()].sort(), q).toEqual(a);
  });

  it('"largest block" lights the single biggest space available now', () => {
    const { floors } = plan(false);
    for (const q of ['largest block', 'biggest block', 'largest available space']) expect(run(floors, q, false).size, q).toBe(1);
  });
});

describe('the plan\'s own label, and a blank query (round 36)', () => {
  it('"Floor 8 Ste 860" and "fl 8 860" find that suite', () => {
    const { floors } = plan(false);
    for (const q of ['Floor 8 Ste 860', 'fl 8 860', 'floor 8, suite 860']) {
      const hits = [...run(floors, q, false).values()];
      expect(hits, q).toEqual(['Suite 860']);
    }
  });
});

describe('a floor and a suite in either order, and a suite pair (round 36)', () => {
  it('"ste 860 floor 8" and "860 fl 8" find the suite as "Floor 8 Ste 860" does', () => {
    const { floors } = plan(false);
    for (const q of ['ste 860 floor 8', '860 fl 8', 'suite 860, floor 8']) expect([...run(floors, q, false).values()], q).toEqual(['Suite 860']);
  });
  it('"1200-1250" lights both suites', () => {
    const { floors } = plan(false);
    expect([...run(floors, '1200-1250', false).values()].sort()).toEqual(['Suite 1200', 'Suite 1250']);
  });
});

describe('round 37: a broker\'s suite spellings', () => {
  it('"Ste. 860", "#860" and "8th floor ste 860" find Suite 860; "ste 850-860" lights both', () => {
    const { floors } = plan(false);
    for (const q of ['Ste. 860', '#860', 'suite #860', 'Floor 8 Ste. 860', '8th floor ste 860']) expect([...run(floors, q, false).values()], q).toEqual(['Suite 860']);
    expect([...run(floors, 'ste 850-860', false).values()].sort()).toEqual(['Suite 850', 'Suite 860']);
  });
});

describe('round 38: suite spellings', () => {
  it('"860 on floor 8" and "1200−1250" (minus sign)', () => {
    const { floors } = plan(false);
    expect([...run(floors, '860 on floor 8', false).values()]).toEqual(['Suite 860']);
    expect([...run(floors, '1200−1250', false).values()].sort()).toEqual(['Suite 1200', 'Suite 1250']);
  });
});

describe('round 37 (Opus): unit, a trailing period, a list of suites, a run of floors', () => {
  it('"unit 860", "Suite 860." and "860, 870"', () => {
    const { floors } = plan(false);
    for (const q of ['unit 860', 'Suite 860.', 'units 860']) expect([...run(floors, q, false).values()], q).toEqual(['Suite 860']);
    expect([...run(floors, '850, 860', false).values()].sort()).toEqual(['Suite 850', 'Suite 860']);
    expect([...run(floors, 'ste 850 and 860', false).values()].sort()).toEqual(['Suite 850', 'Suite 860']);
  });
  it('"floors 3-5" lights the three floors', () => {
    const { floors } = plan(false);
    const lit = new Set(run(floors, 'floors 3-5', false).values());
    expect([...lit].sort()).toEqual(['Floor 3', 'Floor 4', 'Floor 5']);
  });
});

describe('round 38: floors in a state search, and what a place search could not find', () => {
  it('"sublease floors 7-8" lights Floor 7\'s sublease', () => {
    const { floors } = plan(false);
    const hits = run(floors, 'sublease floors 7-8', false);
    expect(hits.size).toBeGreaterThan(0);
    expect([...hits.values()].every((r) => r === 'Sublease on Floor 7')).toBe(true);
  });
  it('"the 8th floor" and "floors 8 and 9" light those floors', () => {
    const { floors } = plan(false);
    expect([...new Set(run(floors, 'the 8th floor', false).values())]).toEqual(['Floor 8']);
    expect([...new Set(run(floors, 'floors 8 and 9', false).values())].sort()).toEqual(['Floor 8', 'Floor 9']);
  });
  it('"31/12/27" lights no suite', () => {
    const { floors } = plan(false);
    expect(run(floors, '31/12/27', false).size).toBe(0);
  });
  it('floorWords', () => {
    expect(floorWords([13])).toBe('Floor 13');
    expect(floorWords([14, 13])).toBe('Floors 13–14');
    expect(floorWords([3, 5, 9])).toBe('Floors 3, 5 and 9');
  });
});
