import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors, isLeaseKind } from './derive';
import { computeKpis, kpiDeltas } from './kpis';

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
    expect(kpiDeltas(today, today)).toEqual({ leased: 0, occupancy: 0, availableDirect: 0, availableSublease: 0, expiring12: 0, walt: 0, pipelineDeals: 0 });
  });
});
