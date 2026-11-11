import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors } from '../domain/derive';
import { computeKpis } from '../domain/kpis';
import { buildWorklist, worklistLeaseCount } from './usePlanModel';

describe('renewal worklist (round 19)', () => {
  const asOf = '2029-11-09';
  const floors = deriveFloors(property, asOf, TODAY);
  const rows = buildWorklist(floors, '12', asOf);
  const kpis = computeKpis(property, floors, asOf);

  it('sums every suite a lease holds on a floor into its row, and keeps every key for the highlight and the CSV', () => {
    const multi = rows.filter((r) => r.segKeys.length > 1);
    expect(multi.length).toBeGreaterThan(0);
    for (const r of multi) {
      const parts = r.segKeys.map((k) => floors.flatMap((f) => f.segments).find((s) => s.key === k)!);
      expect(r.size).toBe(parts.reduce((t, s) => t + s.size, 0));
      expect(new Set(parts.map((s) => s.lease?.id)).size).toBe(1);
    }
  });

  it('agrees with the Expiring 12 mo KPI in SF and in leases, today and in later years', () => {
    expect(rows.reduce((t, r) => t + r.size, 0)).toBe(kpis.expiring12);
    expect(worklistLeaseCount(rows)).toBe(kpis.expiring12Leases);
    for (const d of [TODAY, '2027-06-01', '2028-11-09', '2030-11-09', '2031-06-01']) {
      const fl = deriveFloors(property, d, TODAY);
      const r = buildWorklist(fl, '12', d);
      const k = computeKpis(property, fl, d);
      expect(r.reduce((t, x) => t + x.size, 0), d).toBe(k.expiring12);
      expect(worklistLeaseCount(r), d).toBe(k.expiring12Leases);
    }
  });
});
