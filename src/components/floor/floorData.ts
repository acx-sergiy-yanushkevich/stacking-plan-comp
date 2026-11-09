import type { Deal, Inquiry, ISODate } from '../../domain/types';
import { activeDeals, isLeaseKind, type FloorView, type Segment } from '../../domain/derive';
import { matchingInquiries } from '../../domain/finder';
import type { Issue } from '../../domain/issues';

/** Pure helpers shared by the floor plate, its KPIs and its lists. */

export interface FloorDeal {
  deal: Deal;
  seg: Segment;
}

/** Live (not yet signed) deals on a floor, each once, most advanced stage first within a suite. */
export function liveDeals(floor: FloorView): FloorDeal[] {
  const seen = new Set<string>();
  const out: FloorDeal[] = [];
  for (const seg of floor.segments) {
    const leaseDeals = isLeaseKind(seg.kind) || seg.kind === 'committed' ? (seg.lease?.deals ?? []) : [];
    for (const deal of activeDeals([...(seg.availability?.deals ?? []), ...(seg.marketed?.deals ?? []), ...leaseDeals])) {
      if (seen.has(deal.id)) continue;
      seen.add(deal.id);
      out.push({ deal, seg });
    }
  }
  return out;
}

export interface Space {
  size: number;
  divisible: boolean;
  minDivisible: number | null;
  from: ISODate | null;
}

/** The marketable spaces a segment offers (now or later); empty for plain leased suites. */
export function spacesOf(seg: Segment): Space[] {
  const out: Space[] = [];
  const a = seg.availability;
  if ((seg.kind === 'available' || seg.kind === 'sublease') && a) {
    out.push({ size: seg.size, divisible: a.divisible, minDivisible: a.minDivisible, from: seg.kind === 'available' ? (seg.availableFrom ?? null) : a.availableFrom });
  }
  if (seg.kind === 'projected') out.push({ size: seg.size, divisible: false, minDivisible: null, from: null });
  const m = seg.marketed;
  if (m && m.kind !== 'Sale') out.push({ size: m.size, divisible: m.divisible, minDivisible: m.minDivisible, from: m.availableFrom });
  return out;
}

/** Open inquiries a segment could satisfy. */
export function inquiriesFor(seg: Segment, inquiries: Inquiry[], asOf: ISODate): Inquiry[] {
  const ids = new Set<string>();
  const out: Inquiry[] = [];
  for (const space of spacesOf(seg)) {
    for (const i of matchingInquiries(inquiries, space, asOf)) {
      if (ids.has(i.id)) continue;
      ids.add(i.id);
      out.push(i);
    }
  }
  return out;
}

export interface FloorInquiry {
  inquiry: Inquiry;
  segs: Segment[];
}

/** Open inquiries that fit any available or marketed space on the floor, soonest needed first. */
export function fittingInquiries(floor: FloorView, inquiries: Inquiry[], asOf: ISODate): FloorInquiry[] {
  const byId = new Map<string, FloorInquiry>();
  for (const seg of floor.segments) {
    for (const inquiry of inquiriesFor(seg, inquiries, asOf)) {
      const hit = byId.get(inquiry.id);
      if (hit) hit.segs.push(seg);
      else byId.set(inquiry.id, { inquiry, segs: [seg] });
    }
  }
  return [...byId.values()].sort((a, b) => a.inquiry.neededBy.localeCompare(b.inquiry.neededBy) || b.inquiry.minSize - a.inquiry.minSize);
}

/** The lease on the floor ending soonest (months to expiry ≥ 0); null when none has a date. */
export function nextExpiry(floor: FloorView): Segment | null {
  let best: Segment | null = null;
  for (const s of floor.segments) {
    if (!s.lease || !isLeaseKind(s.kind) || s.monthsToExpiry === null || s.monthsToExpiry < 0 || !s.endDate) continue;
    if (!best || s.monthsToExpiry < best.monthsToExpiry! || (s.monthsToExpiry === best.monthsToExpiry && s.endDate < best.endDate!)) best = s;
  }
  return best;
}

/**
 * Issue titles name tenants and prospects. In prospect-safe mode the title is replaced by a
 * neutral phrase keyed on the issue id prefix (see `findIssues`); titles that only carry
 * floor, suite or SF facts are kept.
 */
export function issueTitle(issue: Issue, safe: boolean): string {
  if (!safe) return issue.title;
  const id = issue.id;
  if (id.startsWith('nounits-')) return 'A lease is missing from the plan';
  if (id.startsWith('nofloor-')) return 'A lease has no floor';
  if (id.startsWith('hold-')) return 'A tenant is in holdover';
  if (id.startsWith('mtm-')) return 'A tenant is month-to-month';
  if (id.startsWith('forsale-occupied-')) return 'A leased suite is offered for sale';
  if (id.startsWith('conflict-')) return 'A leased suite is marked vacant';
  if (id.startsWith('stale-D')) return 'A deal has not been updated in 30+ days';
  if (id.startsWith('stale-L')) return 'A lease has not been verified recently';
  if (id.startsWith('over-') || id.startsWith('gap-') || id.startsWith('orphan-') || id.startsWith('afloor-') || id.startsWith('stale-A')) return issue.title;
  return `${issue.severity === 'error' ? 'Error' : issue.severity === 'warning' ? 'Warning' : 'Note'} on this floor`;
}
