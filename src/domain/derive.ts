import type { Availability, Deal, Floor, ISODate, Lease, Property, Unit } from './types';
import { monthsBetween } from './dates';

/**
 * What a segment of a floor *is* on the as-of date.
 *  leased      – active lease
 *  holdover    – past expiry (before today), no TerminationDate: tenant assumed still in place
 *  mtm         – active lease with no expiration date (month-to-month)
 *  available   – direct lease availability, vacant on as-of (or marketed with a future available-from)
 *  sublease    – sublease availability (still contractually leased by the sublandlord)
 *  committed   – signed lease that has not commenced; space physically vacant
 *  projected   – lease ends before as-of and nothing replaces it (time-travel only)
 *  unmarketed  – leasable area with no lease and no availability record
 *  forsale     – availability with the Sale record type (condo / strata unit offered for sale)
 */
export type SegmentKind = 'leased' | 'holdover' | 'mtm' | 'available' | 'sublease' | 'committed' | 'projected' | 'unmarketed' | 'forsale';

export interface Segment {
  key: string;
  floorId: string;
  kind: SegmentKind;
  size: number;
  order: number;
  suite: string | null;
  lease?: Lease;
  unit?: Unit;
  availability?: Availability;
  /** Space is occupied but already marketed for a later date. */
  marketed?: Availability;
  /** A signed lease will replace the current occupant. */
  next?: { lease: Lease; unit: Unit };
  /** When the lease actually ends: TerminationDate when recorded, otherwise expiration. */
  endDate: ISODate | null;
  /** Months from as-of to endDate (null when not applicable). */
  monthsToExpiry: number | null;
  /** Committed: the closed availability whose Lease Out deal produced this lease. */
  origin?: Availability;
  /** Sublease: months to the head-lease end (monthsToExpiry follows the sublease term). */
  headMonths?: number | null;
  /** Unaccounted area that is probably a lease missing its Unit__c records. */
  suspect?: Lease;
  /** For available segments: date it becomes available when that is after as-of (null = now). */
  availableFrom?: ISODate | null;
}

export interface FloorView {
  floor: Floor;
  leasable: number;
  segments: Segment[];
  /** Contractually leased SF, capped at leasable (over-allocation is reported, never counted). */
  leased: number;
  /** Direct + sublease SF a tenant could take on the as-of date. */
  available: number;
  /** Largest run of adjacent direct availabilities (SF) and the segments in it. */
  maxContiguous: number;
  bestRun: string[];
  overAllocatedBy: number;
  /** Sublease availabilities with no leased suite to sublet from. */
  orphanSubleases: Availability[];
}

export const isLeaseKind = (k: SegmentKind) => k === 'leased' || k === 'holdover' || k === 'mtm' || k === 'sublease';

/**
 * When the tenant actually leaves: a recorded TerminationDate wins (early termination,
 * or a negotiated stay past expiry); otherwise the expiration date. Null = month-to-month.
 */
export function leaseEnd(l: Pick<Lease, 'expiration' | 'termination'>): ISODate | null {
  return l.termination ?? l.expiration;
}

export const activeDeals = (deals: Deal[] | undefined) => (deals ?? []).filter((d) => d.stage !== 'Lease Out');

export function deriveFloors(p: Property, asOf: ISODate, today: ISODate): FloorView[] {
  return p.floors
    .slice()
    .sort((a, b) => b.sequence - a.sequence)
    .map((f) => deriveFloor(p, f, asOf, today));
}

export function segmentIndex(floors: FloorView[]): Map<string, Segment> {
  return new Map(floors.flatMap((f) => f.segments).map((s) => [s.key, s]));
}

function deriveFloor(p: Property, floor: Floor, asOf: ISODate, today: ISODate): FloorView {
  const leasable = floor.size - floor.nonLeasable;
  const bySuite = new Map<string, Segment>();
  const segments: Segment[] = [];
  const committedLater: Array<{ lease: Lease; unit: Unit }> = [];
  const orphans: Availability[] = [];
  const replace = (old: Segment, seg: Segment) => segments.splice(segments.indexOf(old), 1, seg);

  // 1. Leased units
  for (const lease of p.leases) {
    // Terminated before today = history (skip). Terminating between today and as-of = projected vacancy.
    if (lease.termination && lease.termination < asOf && lease.termination < today) continue;
    for (const unit of lease.units) {
      if (unit.floorId !== floor.id) continue;
      if (lease.commencement > asOf) {
        committedLater.push({ lease, unit });
        continue;
      }
      const end = leaseEnd(lease);
      let kind: SegmentKind;
      if (end === null) kind = 'mtm';
      else if (end >= asOf) kind = 'leased';
      else if (!lease.termination && end < today) kind = 'holdover';
      else kind = 'projected';
      const seg: Segment = {
        key: unit.id,
        floorId: floor.id,
        kind,
        size: unit.size,
        order: unit.order,
        suite: unit.suite,
        lease,
        unit,
        endDate: end,
        monthsToExpiry: end && kind !== 'projected' ? monthsBetween(asOf, end) : null,
      };
      segments.push(seg);
      bySuite.set(unit.suite, seg);
    }
  }

  // 2. Committed (signed, not commenced) leases
  for (const c of committedLater) {
    const occupant = bySuite.get(c.unit.suite);
    if (occupant && occupant.kind !== 'projected') {
      occupant.next = c;
      continue;
    }
    const end = leaseEnd(c.lease);
    const seg: Segment = {
      key: c.unit.id,
      floorId: floor.id,
      kind: 'committed',
      size: c.unit.size,
      order: c.unit.order,
      suite: c.unit.suite,
      lease: c.lease,
      unit: c.unit,
      endDate: end,
      monthsToExpiry: end ? monthsBetween(asOf, end) : null,
      origin: p.availabilities.find((a) => a.floorId === floor.id && a.suite === c.unit.suite && a.status === 'Closed'),
    };
    if (occupant) replace(occupant, seg);
    else segments.push(seg);
    bySuite.set(c.unit.suite, seg);
  }

  // 3. Availabilities
  for (const a of p.availabilities) {
    if (a.floorId !== floor.id || a.status !== 'Open') continue;
    const occupant = bySuite.get(a.suite);
    const availableNow = !a.availableFrom || a.availableFrom <= asOf;

    if (a.kind === 'Sale') {
      // A unit offered for sale: drawn as its own state unless a lease still covers the suite.
      if (occupant && occupant.kind !== 'projected') {
        occupant.marketed = a;
        continue;
      }
      const seg: Segment = {
        key: a.id,
        floorId: floor.id,
        kind: 'forsale',
        size: a.size,
        order: a.order,
        suite: a.suite,
        availability: a,
        endDate: null,
        monthsToExpiry: null,
      };
      if (occupant) replace(occupant, seg);
      else segments.push(seg);
      bySuite.set(a.suite, seg);
      continue;
    }

    if (a.sublease) {
      if (occupant && isLeaseKind(occupant.kind)) {
        if (availableNow) {
          occupant.kind = 'sublease';
          occupant.availability = a;
          occupant.headMonths = occupant.monthsToExpiry;
          if (a.subleaseExpiration) occupant.monthsToExpiry = monthsBetween(asOf, a.subleaseExpiration);
        } else occupant.marketed = a;
      } else orphans.push(a);
      continue;
    }

    if (occupant && occupant.kind !== 'projected') {
      // Occupied, marketed for later (e.g. tenant leaving at expiry).
      if (occupant.kind !== 'committed') occupant.marketed = a;
      continue;
    }
    if (occupant && !availableNow) {
      // Tenant gone but space not on the market until later.
      occupant.marketed = a;
      continue;
    }

    const seg: Segment = {
      key: a.id,
      floorId: floor.id,
      kind: 'available',
      size: a.size,
      order: a.order,
      suite: a.suite,
      availability: a,
      endDate: null,
      monthsToExpiry: null,
      availableFrom: availableNow ? null : a.availableFrom,
    };
    if (occupant) {
      seg.lease = occupant.lease; // keep "previously X" context for the panel only
      replace(occupant, seg);
    } else segments.push(seg);
    bySuite.set(a.suite, seg);
  }

  segments.sort((a, b) => a.order - b.order);

  // 4. Unaccounted area: link it to a lease on this floor that has no Unit__c records.
  const used = segments.reduce((s, x) => s + x.size, 0);
  const gap = leasable - used;
  if (gap > 0) {
    const suspect = p.leases.find(
      (l) => l.floorId === floor.id && l.units.length === 0 && l.commencement <= asOf && (!leaseEnd(l) || leaseEnd(l)! >= asOf),
    );
    segments.push({
      key: `${floor.id}-gap`,
      floorId: floor.id,
      kind: 'unmarketed',
      size: gap,
      order: 999,
      suite: null,
      endDate: null,
      monthsToExpiry: null,
      suspect,
    });
  }

  // Leased includes signed leases not yet commenced (owner-report convention); physical occupancy does not.
  const rawLeased = segments.filter((s) => isLeaseKind(s.kind) || s.kind === 'committed').reduce((s, x) => s + x.size, 0);
  const available = segments
    .filter((s) => (s.kind === 'available' && !s.availableFrom) || s.kind === 'sublease')
    .reduce((s, x) => s + x.size, 0);

  let maxContiguous = 0;
  let bestRun: string[] = [];
  let run = 0;
  let runKeys: string[] = [];
  for (const s of segments) {
    const directNow = s.kind === 'available' && !s.availableFrom;
    if (directNow) {
      run += s.size;
      runKeys = [...runKeys, s.key];
      if (run > maxContiguous) {
        maxContiguous = run;
        bestRun = runKeys;
      }
    } else {
      run = 0;
      runKeys = [];
    }
  }

  return {
    floor,
    leasable,
    segments,
    leased: Math.min(rawLeased, leasable),
    available,
    maxContiguous,
    bestRun,
    overAllocatedBy: Math.max(0, -gap),
    orphanSubleases: orphans,
  };
}

/** Every distinct floor a lease occupies (for "also on floors 9, 10"). */
export function leaseFloors(p: Property, lease: Lease): Floor[] {
  const ids = new Set(lease.units.map((u) => u.floorId));
  return p.floors.filter((f) => ids.has(f.id)).sort((a, b) => a.sequence - b.sequence);
}
