import type { ISODate } from './types';
import { yearOf } from './dates';
import type { FloorView, Segment } from './derive';

export type RollMode = 'rolling' | 'calendar';

export interface RolloverBucket {
  /** rolling: period index (0 = next 12 months); calendar: the year */
  key: number;
  label: string;
  sf: number;
  leases: number;
}

/** Which rollover bucket a lease segment falls in (null = none / not a lease ending). */
export function bucketOf(s: Segment, mode: RollMode, tailKey?: number): number | null {
  const k = rawBucket(s, mode);
  return k !== null && tailKey !== undefined && k > tailKey ? tailKey : k;
}

function rawBucket(s: Segment, mode: RollMode): number | null {
  // Signed-but-not-commenced leases roll on their own end date too (they are in the rent roll).
  if ((s.kind !== 'leased' && s.kind !== 'sublease' && s.kind !== 'committed') || !s.endDate) return null;
  if (mode === 'calendar') return yearOf(s.endDate);
  // landlord view: the head-lease end, measured from as-of (not the sublease term)
  return s.monthsToExpiry === null ? null : Math.floor((s.kind === 'sublease' ? (s.headMonths ?? s.monthsToExpiry) : s.monthsToExpiry) / 12);
}

/**
 * SF ending per period (landlord view: head-lease end date). Rolling periods are measured
 * in months from the as-of date (the default); calendar years are offered for analysts.
 * Holdover and MTM are reported separately as "at risk".
 */
export function rollover(
  floors: FloorView[],
  asOf: ISODate,
  mode: RollMode = 'rolling',
  periods = 8,
): { buckets: RolloverBucket[]; atRisk: number; overAllocated: Array<{ floor: string; sf: number }> } {
  const start = yearOf(asOf);
  // `periods` buckets plus a catch-all, so no lease ever falls off the end (e.g. a 2034 expiry in calendar mode).
  const buckets: RolloverBucket[] = Array.from({ length: periods + 1 }, (_, i) =>
    mode === 'calendar'
      ? { key: start + i, label: i === periods ? `${start + i}+` : String(start + i), sf: 0, leases: 0 }
      : { key: i, label: i === periods ? `${i}+ yr` : i === 0 ? '< 12 mo' : `${i}–${i + 1} yr`, sf: 0, leases: 0 },
  );
  const tailKey = buckets[buckets.length - 1].key;
  const seen = new Map<number, Set<string>>();
  let atRisk = 0;
  // Real lease SF (exactly what each lease says), the same basis as the "Expiring < 12 mo" KPI and the
  // renewal worklist. Over-allocated floors are reported once, as `overAllocated`, never pro-rated.
  for (const s of floors.flatMap((f) => f.segments)) {
    if (!s.lease) continue;
    if (s.kind === 'holdover' || s.kind === 'mtm') {
      atRisk += s.size;
      continue;
    }
    const k = bucketOf(s, mode, tailKey);
    const b = k === null ? undefined : buckets.find((x) => x.key === k);
    if (!b) continue;
    b.sf += s.size;
    const set = seen.get(b.key) ?? new Set();
    set.add(s.lease.id);
    seen.set(b.key, set);
    b.leases = set.size;
  }
  const overAllocated = floors.filter((f) => f.overAllocatedBy > 0).map((f) => ({ floor: f.floor.name, sf: f.overAllocatedBy }));
  return { buckets, atRisk, overAllocated };
}
