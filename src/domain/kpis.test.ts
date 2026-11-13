import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors, isLeaseKind } from './derive';
import { annualRate } from './format';
import { comingSupply, computeKpis, kpiDeltas, largestBlock } from './kpis';
import { publishedFloors, safeFloors } from './safe';

const at = (asOf: string) => deriveFloors(property, asOf, TODAY);

describe('computeKpis today', () => {
  const floors = at(TODAY);
  const k = computeKpis(property, floors, TODAY);

  // Leasable: 22,600 − 8,000 + 7 × 21,400 + 3 × 20,800 + 18,600 = 245,400.
  // Leased (lease kinds + committed, capped per floor): F1 8,000 · F2 16,000 · F3 15,900 · F4 21,400 (13,400 + 8,000 committed)
  // · F5 21,400 · F6 21,400 · F7 21,400 (21,900 capped) · F8 14,000 · F9–F11 3 × 20,800 · F12 9,300 = 211,200.
  it('occupancy is leased / leasable, exact against the mock', () => {
    expect(k.leasable).toBe(245400);
    expect(k.leased).toBe(211200);
    expect(k.occupancy).toBeCloseTo(211200 / 245400, 10);
    expect(Math.abs(k.occupancy - 0.86)).toBeLessThan(0.005);
  });
  it('counts the SF of leases ending inside 12 months (landlord view)', () => {
    // Café 2,400 (Feb 2027) + NA Asset Holdings 6,500 (Oct 2027) + BeachBody 5,000 (Apr 2027) + Cirrus 21,400 (Mar 2027).
    expect(k.expiring12).toBe(35300);
    expect(k.expiring12Leases).toBe(4);
  });
  it('WALT lands near three years', () => {
    expect(k.walt).toBeGreaterThan(2.9);
    expect(k.walt).toBeLessThan(3.1);
  });
  it('pipeline counts every live deal once', () => {
    expect(k.pipeline.deals).toBe(9);
  });
  it('for-sale units are reported separately and are neither leased nor available', () => {
    expect(k.forSale).toBe(2600);
    expect(k.availableDirect).toBe(4000 + 5500 + 4200 + 3200 + 9300);
    expect(k.availableSublease).toBe(7000);
  });
  it('rent by type leads with the largest share and never blends types', () => {
    expect(k.rentByType[0].type).toBe('FSG');
    expect(new Set(k.rentByType.map((r) => r.type)).size).toBe(k.rentByType.length);
  });
  it('asking rent by type covers the marketed vacancies (direct and sublease), lowest low to highest high, largest share first', () => {
    const listed = floors.flatMap((f) => f.segments).filter((s) => s.availability && (s.kind === 'available' || s.kind === 'sublease'));
    expect(listed.length).toBeGreaterThan(0);
    expect(k.askingByType.length).toBeGreaterThan(0);
    expect(k.askingByType.map((a) => a.sf)).toEqual([...k.askingByType.map((a) => a.sf)].sort((a, b) => b - a));
    for (const a of k.askingByType) {
      const own = listed.filter((s) => s.availability!.leaseType === a.type);
      expect(a.sf, `${a.type} SF`).toBe(own.reduce((t, s) => t + s.size, 0));
      expect(a.low).toBe(Math.min(...own.map((s) => annualRate(s.availability!.rentLow, s.availability!.rateUnit))));
      expect(a.high).toBe(Math.max(...own.map((s) => annualRate(s.availability!.rentHigh, s.availability!.rateUnit))));
    }
  });
  it('rent by type is weighted by recorded SF, so each figure is a sum of rent-roll rows', () => {
    // The lease rows that carry a rent: in place (holdover, MTM and sublandlords included), not confidential.
    const rows = floors.flatMap((f) => f.segments).filter((s) => s.lease && isLeaseKind(s.kind) && !s.lease.confidential && s.lease.rate !== null);
    for (const r of k.rentByType) {
      const own = rows.filter((s) => s.lease!.leaseType === r.type);
      const recorded = own.reduce((t, s) => t + s.size, 0);
      expect(r.sf, `${r.type} SF`).toBe(recorded);
      expect(Number.isInteger(r.sf)).toBe(true);
      expect(r.avg).toBeCloseTo(own.reduce((t, s) => t + annualRate(s.lease!.rate!, s.lease!.rateUnit) * s.size, 0) / recorded, 10);
    }
    // Floor 7 is over-allocated by 500 SF: the recorded SF is not scaled down to the capped leased figure.
    const f7 = floors.find((f) => f.floor.id === 'F7')!;
    expect(f7.overAllocatedBy).toBe(500);
    const f7Fsg = f7.segments.filter((s) => rows.includes(s) && s.lease!.leaseType === 'FSG').reduce((t, s) => t + s.size, 0);
    expect(f7Fsg).toBeGreaterThan(0);
    expect(k.rentByType.find((r) => r.type === 'FSG')!.sf).toBe(rows.filter((s) => s.lease!.leaseType === 'FSG').reduce((t, s) => t + s.size, 0));
  });
  it('leaseCount is the number of distinct leases drawn on the plan', () => {
    const drawn = new Set(
      floors
        .flatMap((f) => f.segments)
        .filter((s) => s.lease && (isLeaseKind(s.kind) || s.kind === 'committed'))
        .map((s) => s.lease!.id),
    );
    // Every lease with Unit records (L01–L04, L06–L19): the two with none (L05, L20) never render.
    expect(drawn.size).toBe(18);
    expect(k.leaseCount).toBe(18);
  });
  it('unaccounted sums unmarketed and projected; the phantom lease is flagged', () => {
    expect(k.unaccounted).toBe(5400);
    expect(k.unplacedLease).toBe(5400);
    expect(k.committed).toBe(8000);
    expect(k.comingAvailable).toEqual({ sf: 21400, from: '2027-04-01' });
  });
});

describe('kpiDeltas', () => {
  it('is now minus base; leased falls once the 2027 expirations have passed', () => {
    const today = computeKpis(property, at(TODAY), TODAY);
    const later = computeKpis(property, at('2028-01-01'), '2028-01-01');
    const d = kpiDeltas(later, today);
    expect(d.leased).toBeLessThan(0);
    expect(d.leased).toBe(later.leased - today.leased);
    expect(d.occupancy).toBeCloseTo(later.occupancy - today.occupancy, 10);
    expect(d.pipelineDeals).toBe(later.pipeline.deals - today.pipeline.deals);
    expect(kpiDeltas(today, today)).toEqual({ leased: 0, occupancy: 0, availableDirect: 0, availableSublease: 0, expiring12: 0, walt: 0, pipelineDeals: 0, maxContiguous: 0 });
  });
});

describe('comingSupply', () => {
  const segs = at(TODAY).flatMap((f) => f.segments);

  it('sums occupied space marketed for a later date, with the earliest date', () => {
    expect(comingSupply(segs, TODAY, false)).toEqual({ sf: 21400, from: '2027-04-01' });
  });
  it('leaves a quiet listing out of what a prospect is told is coming', () => {
    expect(comingSupply(segs, TODAY, true)).toEqual({ sf: 0, from: null });
  });
  it('keeps a published listing in prospect-safe mode', () => {
    const published = segs.map((s) => (s.marketed ? { ...s, marketed: { ...s.marketed, published: true } } : s));
    expect(comingSupply(published, TODAY, true)).toEqual({ sf: 21400, from: '2027-04-01' });
  });
  it('counts nothing once the available-from date has passed', () => {
    expect(comingSupply(segs, '2027-04-01', false)).toEqual({ sf: 0, from: null });
  });
});

describe('largestBlock', () => {
  const floors = at(TODAY);
  const k = computeKpis(property, floors, TODAY);

  it('is the block the KPI reports: its size, its floor and the suites that make it up', () => {
    expect(k.maxContiguous).toEqual(largestBlock(floors));
    expect(k.maxContiguous.size).toBe(9300);
    expect(k.maxContiguous.floorId).toBe('F12');
    expect(k.maxContiguous.floorName).toBe('Floor 12');
    const f12 = floors.find((f) => f.floor.id === 'F12')!;
    expect(k.maxContiguous.keys).toEqual(f12.bestRun);
    // The suites add up to the figure, each is direct space free today, and they sit side by side on the floor.
    const segs = k.maxContiguous.keys.map((key) => f12.segments.find((s) => s.key === key)!);
    expect(segs.reduce((t, s) => t + s.size, 0)).toBe(k.maxContiguous.size);
    for (const s of segs) expect(s.kind === 'available' && !s.availableFrom).toBe(true);
    const at0 = f12.segments.indexOf(segs[0]);
    expect(f12.segments.slice(at0, at0 + segs.length)).toEqual(segs);
  });

  it('marks every suite of a block that spans several', () => {
    // Floor 8 offers two adjacent direct suites (4,200 + 3,200 SF): with Floor 12 out of the count, they are the block.
    const rest = floors.filter((f) => f.floor.id !== 'F12');
    expect(largestBlock(rest)).toEqual({ size: 7400, floorId: 'F8', floorName: 'Floor 8', keys: ['A06', 'A07'] });
  });

  it('the upper floor wins a tie, and no direct space is no block', () => {
    const f8 = floors.find((f) => f.floor.id === 'F8')!;
    const twin = { ...f8, floor: { ...f8.floor, id: 'F8b', name: 'Floor 8b' } };
    expect(largestBlock([f8, twin]).floorId).toBe('F8');
    expect(largestBlock([twin, f8]).floorId).toBe('F8b');
    expect(largestBlock(floors.filter((f) => f.maxContiguous === 0))).toEqual({ size: 0, floorId: null, floorName: null, keys: [] });
  });

  it('points at suites that are on the plan a prospect is shown, at every as-of date', () => {
    for (const asOf of [TODAY, '2027-06-01', '2028-01-01'])
      for (const safe of [false, true]) {
        // As the model does it: the KPIs from the published floors, the plan from the prospect-safe ones.
        const totals = publishedFloors(at(asOf), safe);
        const drawn = safeFloors(totals, safe);
        const block = computeKpis(property, totals, asOf).maxContiguous;
        expect(block, `${asOf} safe=${safe}`).toEqual(largestBlock(drawn));
        const keys = new Set(drawn.flatMap((f) => f.segments.map((s) => s.key)));
        for (const key of block.keys) expect(keys.has(key)).toBe(true);
      }
  });
});

describe('availableKeys', () => {
  it('are the suites behind the Available figure: direct space free today, and sublease space', () => {
    const floors = at(TODAY);
    const k = computeKpis(property, floors, TODAY);
    const segs = floors.flatMap((f) => f.segments).filter((s) => k.availableKeys.includes(s.key));
    expect(segs.length).toBe(k.availableKeys.length);
    expect(segs.reduce((t, s) => t + s.size, 0)).toBe(k.availableDirect + k.availableSublease);
    expect(floors.reduce((t, f) => t + f.available, 0)).toBe(k.availableDirect + k.availableSublease);
    for (const key of k.maxContiguous.keys) expect(k.availableKeys).toContain(key);
  });
});
