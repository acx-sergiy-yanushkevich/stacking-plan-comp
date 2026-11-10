import type { ISODate, LeaseType, Property } from './types';
import { yearsBetween } from './dates';
import { annualRate } from './format';
import { activeDeals, isLeaseKind, type FloorView, type Segment, type SegmentKind } from './derive';
import { marketedFor } from './safe';

export interface RentByType {
  type: LeaseType;
  /** Annual $/SF, weighted by `sf`. */
  avg: number;
  /**
   * Recorded SF of the leases averaged: the sum of their rent-roll rows. It is not scaled by the
   * over-allocation cap, so the per-type figures can add up to more than the capped leased SF.
   */
  sf: number;
}

/** Occupied space already marketed for a later date. */
export interface ComingSupply {
  sf: number;
  /** Earliest available-from date among it; null when there is none. */
  from: ISODate | null;
}

/**
 * Coming supply among `segments` (a floor's, or the whole building's): occupied suites with an
 * availability dated after `asOf`. Prospect-safe mode leaves quiet listings out.
 */
export function comingSupply(segments: Segment[], asOf: ISODate, safe: boolean): ComingSupply {
  let sf = 0;
  let from: ISODate | null = null;
  for (const s of segments) {
    const m = marketedFor(s, safe);
    if (!m || !m.availableFrom || m.availableFrom <= asOf) continue;
    sf += m.size;
    if (from === null || m.availableFrom < from) from = m.availableFrom;
  }
  return { sf, from };
}

export interface Kpis {
  /** Unaccounted area traced to a lease that has no unit records. */
  unplacedLease: number;
  /** Occupied space already marketed for a later date, quiet listings included (see `comingSupply` for the prospect-safe figure). */
  comingAvailable: ComingSupply;
  rentable: number;
  leasable: number;
  leased: number;
  /** Leased share of leasable RSF (contractual: includes space offered for sublease). */
  occupancy: number;
  /** Physically occupied share: excludes vacant sublease space. */
  physical: number;
  availableDirect: number;
  availableSublease: number;
  committed: number;
  unaccounted: number;
  /** Units offered for sale (Sale record type): neither leased nor available. */
  forSale: number;
  maxContiguous: { size: number; floorName: string | null };
  walt: number;
  /** In-place rent per lease type, weighted by recorded SF, largest share first. Never blended across types. */
  rentByType: RentByType[];
  expiring12: number;
  /** Distinct leases behind `expiring12`. */
  expiring12Leases: number;
  /** Distinct leases drawn on the plan (leased, holdover, MTM, sublease or committed). */
  leaseCount: number;
  pipeline: { deals: number; onVacancy: number; sf: number };
}

export function computeKpis(p: Property, floors: FloorView[], asOf: ISODate): Kpis {
  const all = floors.flatMap((f) => f.segments);
  const leasable = floors.reduce((s, f) => s + f.leasable, 0);
  const leased = floors.reduce((s, f) => s + f.leased, 0);
  const sum = (k: SegmentKind) => all.filter((s) => s.kind === k).reduce((t, s) => t + s.size, 0);

  let best = { size: 0, floorName: null as string | null };
  for (const f of floors) if (f.maxContiguous > best.size) best = { size: f.maxContiguous, floorName: f.floor.name };

  // WALT: SF-weighted remaining term to lease end (head lease for subleased space). MTM/holdover = 0.
  let waltNum = 0;
  let waltDen = 0;
  const rent = new Map<LeaseType, { num: number; sf: number }>();
  for (const f of floors) {
    // Over-allocated floor: scale the WALT weights so they sum to the capped leased SF, the figure WALT is read against.
    const raw = f.segments.filter((s) => isLeaseKind(s.kind)).reduce((t, s) => t + s.size, 0);
    const factor = raw > f.leased && raw > 0 ? f.leased / raw : 1;
    for (const s of f.segments) {
      if (!s.lease || !isLeaseKind(s.kind)) continue;
      const remaining = (s.kind === 'leased' || s.kind === 'sublease') && s.endDate ? Math.max(0, yearsBetween(asOf, s.endDate)) : 0;
      waltNum += remaining * s.size * factor;
      waltDen += s.size * factor;
      // In-place rent is an average of records, so each lease weighs its recorded SF: the SF beside
      // each type is then the sum of those rent-roll rows, with no cap applied.
      if (!s.lease.confidential && s.lease.rate !== null) {
        const r = rent.get(s.lease.leaseType) ?? { num: 0, sf: 0 };
        r.num += annualRate(s.lease.rate, s.lease.rateUnit) * s.size;
        r.sf += s.size;
        rent.set(s.lease.leaseType, r);
      }
    }
  }
  const rentByType = [...rent.entries()]
    .map(([type, r]) => ({ type, avg: r.num / r.sf, sf: r.sf }))
    .sort((a, b) => b.sf - a.sf);

  const expiringSegs = all.filter((s) => {
    if (s.kind !== 'leased' && s.kind !== 'sublease' && s.kind !== 'committed') return false;
    const m = s.kind === 'sublease' ? (s.headMonths ?? s.monthsToExpiry) : s.monthsToExpiry; // landlord view: head lease
    return m !== null && m < 12;
  });
  const expiring12 = expiringSegs.reduce((t, s) => t + s.size, 0);
  const expiring12Leases = new Set(expiringSegs.map((s) => s.lease?.id).filter((id): id is string => id !== undefined)).size;

  const leaseCount = new Set(
    all
      .filter((s) => s.lease && (isLeaseKind(s.kind) || s.kind === 'committed'))
      .map((s) => s.lease!.id),
  ).size;

  // Pipeline: count every live deal, but SF in negotiation counts each space once
  // (competing deals on the same suite are alternatives, not additive).
  const seen = new Set<string>();
  let onVacancy = 0;
  let pipelineSf = 0;
  for (const s of all) {
    const vacancyDeals = activeDeals([...(s.availability?.deals ?? []), ...(s.marketed?.deals ?? [])]).filter((d) => !seen.has(d.id));
    vacancyDeals.forEach((d) => seen.add(d.id));
    onVacancy += vacancyDeals.length;
    // Same rule as the badges: renewals count while the lease is in place or committed — not once it has ended
    // in the projection (the block still names the open renewal so the broker can act on it).
    const carries = isLeaseKind(s.kind) || s.kind === 'committed';
    const renewals = carries ? activeDeals(s.lease?.deals).filter((d) => !seen.has(d.id)) : [];
    renewals.forEach((d) => seen.add(d.id));
    const live = [...vacancyDeals, ...renewals];
    if (live.length) pipelineSf += Math.min(s.size, Math.max(...live.map((d) => d.size)));
  }

  return {
    unplacedLease: all.filter((x) => x.kind === 'unmarketed' && x.suspect).reduce((t, x) => t + x.size, 0),
    comingAvailable: comingSupply(all, asOf, false),
    rentable: p.totalBuildingArea,
    leasable,
    leased,
    occupancy: leasable ? leased / leasable : 0,
    physical: leasable
      ? floors.reduce(
          (t, f) =>
            t +
            Math.min(
              f.leasable,
              f.segments
                .filter((s) => s.kind === 'leased' || s.kind === 'holdover' || s.kind === 'mtm' || (s.kind === 'sublease' && !s.availability?.isVacant))
                .reduce((x, s) => x + s.size, 0),
            ),
          0,
        ) / leasable
      : 0,
    availableDirect: all.filter((s) => s.kind === 'available' && !s.availableFrom).reduce((t, s) => t + s.size, 0),
    availableSublease: sum('sublease'),
    committed: sum('committed'),
    unaccounted: sum('unmarketed') + sum('projected'),
    forSale: sum('forsale'),
    maxContiguous: best,
    walt: waltDen ? waltNum / waltDen : 0,
    rentByType,
    expiring12,
    expiring12Leases,
    leaseCount,
    pipeline: { deals: seen.size, onVacancy, sf: pipelineSf },
  };
}

/** `now` minus `base`: how the headline figures moved between two as-of dates. */
export function kpiDeltas(
  now: Kpis,
  base: Kpis,
): { leased: number; occupancy: number; availableDirect: number; availableSublease: number; expiring12: number; walt: number; pipelineDeals: number; maxContiguous: number } {
  return {
    leased: now.leased - base.leased,
    occupancy: now.occupancy - base.occupancy,
    availableDirect: now.availableDirect - base.availableDirect,
    availableSublease: now.availableSublease - base.availableSublease,
    expiring12: now.expiring12 - base.expiring12,
    walt: now.walt - base.walt,
    pipelineDeals: now.pipeline.deals - base.pipeline.deals,
    maxContiguous: now.maxContiguous.size - base.maxContiguous.size,
  };
}
