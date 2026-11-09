import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors } from './derive';
import { bucketOf, rollover, type RollMode } from './rollover';

const floors = deriveFloors(property, TODAY, TODAY);
const rolling = (s: { kind: string }) => s.kind === 'leased' || s.kind === 'sublease' || s.kind === 'committed';

describe('rollover (rolling, default)', () => {
  const r = rollover(floors, TODAY);

  it('bucket 0 matches the Expiring < 12 mo KPI', () => {
    expect(r.buckets[0].label).toBe('< 12 mo');
    expect(r.buckets[0].sf).toBe(35300);
    expect(r.buckets[0].leases).toBe(4);
  });
  it('holdover and MTM are at risk, not in a bucket', () => {
    expect(r.atRisk).toBe(11000 + 6200);
  });
  it('reports the over-allocated floor once instead of pro-rating', () => {
    expect(r.overAllocated).toEqual([{ floor: 'Floor 7', sf: 500 }]);
  });
  it('has periods + 1 buckets with a catch-all tail', () => {
    expect(r.buckets).toHaveLength(9);
    expect(r.buckets.at(-1)!.label).toBe('8+ yr');
  });
});

describe('rollover (calendar)', () => {
  const r = rollover(floors, TODAY, 'calendar');

  it('starts at the as-of year and ends in an open-ended tail', () => {
    expect(r.buckets[0].label).toBe('2026');
    expect(r.buckets.at(-1)!.label).toMatch(/\+$/);
    expect(r.buckets.at(-1)!.label).toBe('2034+');
  });
  it('places the 2034 committed lease in the tail', () => {
    expect(r.buckets.at(-1)!.sf).toBe(8000);
  });
});

describe('bucketOf', () => {
  const segs = floors.flatMap((f) => f.segments);

  for (const mode of ['rolling', 'calendar'] as RollMode[]) {
    it(`every lease segment with an end date lands in exactly one bucket (${mode})`, () => {
      const r = rollover(floors, TODAY, mode);
      const tailKey = r.buckets.at(-1)!.key;
      const ending = segs.filter((s) => s.lease && rolling(s) && s.endDate);
      expect(ending.length).toBeGreaterThan(0);
      for (const s of ending) {
        const k = bucketOf(s, mode, tailKey);
        expect(k).not.toBeNull();
        expect(r.buckets.filter((b) => b.key === k)).toHaveLength(1);
      }
      expect(r.buckets.reduce((t, b) => t + b.sf, 0)).toBe(ending.reduce((t, s) => t + s.size, 0));
    });
  }

  it('returns null for holdover, MTM, availabilities and gaps', () => {
    for (const s of segs.filter((x) => !rolling(x))) expect(bucketOf(s, 'rolling')).toBeNull();
  });
  it('clamps beyond-horizon keys to the tail', () => {
    const committed = segs.find((s) => s.kind === 'committed')!;
    expect(bucketOf(committed, 'calendar')).toBe(2034);
    expect(bucketOf(committed, 'calendar', 2030)).toBe(2030);
  });
});
