import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors, type FloorView } from '../domain/derive';
import { computeKpis } from '../domain/kpis';
import { readQuery } from '../domain/query';
import { publishedFloors, safeFloors, safeKpis } from '../domain/safe';
import { search } from './usePlanModel';

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
