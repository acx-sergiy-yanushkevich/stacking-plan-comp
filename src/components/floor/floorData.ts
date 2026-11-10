import type { Deal, Inquiry, ISODate } from '../../domain/types';
import { fmtMonthYearShort } from '../../domain/dates';
import { activeDeals, isLeaseKind, type FloorView, type Segment } from '../../domain/derive';
import { matchingInquiries } from '../../domain/finder';
import { sf } from '../../domain/format';
import type { Issue } from '../../domain/issues';
import { comingSupply, type ComingSupply } from '../../domain/kpis';
import { visibleDeals, visibleInquiries, visibleIssues } from '../../domain/safe';

/**
 * Pure helpers shared by the floor plate, its KPIs and its lists. Everything a list renders takes
 * `safe`, so a list cannot be built without the prospect-safe policy having been applied to it.
 */

export interface FloorDeal {
  deal: Deal;
  seg: Segment;
}

/**
 * Live (not yet signed) deals on a floor, each once, in plan order. This is the unfiltered record:
 * anything that renders deals takes `floorDeals`, which applies the prospect-safe policy.
 */
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

/** The live deals a floor's list may show: all of them, or none in prospect-safe mode. */
export function floorDeals(floor: FloorView, safe: boolean): FloorDeal[] {
  return visibleDeals(liveDeals(floor), safe);
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

/** Open inquiries that fit any available or marketed space on the floor, soonest needed first; none in prospect-safe mode. */
export function fittingInquiries(floor: FloorView, inquiries: Inquiry[], asOf: ISODate, safe: boolean): FloorInquiry[] {
  const byId = new Map<string, FloorInquiry>();
  const open = visibleInquiries(inquiries, safe);
  for (const seg of floor.segments) {
    for (const inquiry of inquiriesFor(seg, open, asOf)) {
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
    // A segment whose term is withheld (prospect-safe) has no lease expiry to rank: a sublet suite's date there is the offer's.
    if (!s.lease || !isLeaseKind(s.kind) || s.termWithheld || s.monthsToExpiry === null || s.monthsToExpiry < 0 || !s.endDate) continue;
    if (!best || s.monthsToExpiry < best.monthsToExpiry! || (s.monthsToExpiry === best.monthsToExpiry && s.endDate < best.endDate!)) best = s;
  }
  return best;
}

export interface CallTarget {
  lease: NonNullable<Segment['lease']>;
  seg: Segment;
  /** Why this tenant, in a word or two for the button: "holdover", "month-to-month", "expires Feb '27". */
  reason: string;
  /** The same, as a clause for the tooltip: "in holdover", "the next lease to expire". */
  why: string;
}

/**
 * Who a floor-level "Log call" should reach: the tenant who most needs the call. A holdover tenant
 * comes first (the lease has already expired), then a month-to-month tenant (no end date at all),
 * then the lease ending soonest. Among several of the same urgency the largest suite wins. Null when
 * the floor has no tenant to call. Record actions are withheld in prospect-safe mode, where the
 * projected floors carry no lease term to rank by either.
 */
export function callTarget(floor: FloorView): CallTarget | null {
  const inPlace = floor.segments.filter((s): s is Segment & { lease: NonNullable<Segment['lease']> } => !!s.lease && isLeaseKind(s.kind) && !s.termWithheld);
  const largest = (kind: Segment['kind']) => inPlace.filter((s) => s.kind === kind).sort((a, b) => b.size - a.size)[0];
  const holdover = largest('holdover');
  if (holdover) return { lease: holdover.lease, seg: holdover, reason: 'holdover', why: 'in holdover, the most urgent call' };
  const mtm = largest('mtm');
  if (mtm) return { lease: mtm.lease, seg: mtm, reason: 'month-to-month', why: 'month-to-month, no end date' };
  const next = nextExpiry(floor);
  if (next?.lease && next.endDate) return { lease: next.lease, seg: next, reason: `expires ${fmtMonthYearShort(next.endDate)}`, why: 'the next lease to expire' };
  return null;
}

/** Data issues recorded against a floor; none in prospect-safe mode. */
export function floorIssues(issues: Issue[], floorId: string, safe: boolean): Issue[] {
  return visibleIssues(issues, safe).filter((i) => i.floorId === floorId);
}

/** Occupied space on the floor that is marketed for a later date (quiet listings left out in prospect-safe mode). */
export function floorComing(floor: FloorView, asOf: ISODate, safe: boolean): ComingSupply | null {
  const coming = comingSupply(floor.segments, asOf, safe);
  return coming.sf > 0 && coming.from ? coming : null;
}

/** "21,400 SF marketed from Apr '27": the coming supply in a phrase. */
export function comingText(coming: ComingSupply): string {
  return `${sf(coming.sf)} marketed${coming.from ? ` from ${fmtMonthYearShort(coming.from)}` : ''}`;
}

/**
 * What a floor offers, in a phrase, for a heading or a summary line. A floor with nothing vacant
 * but space marketed for later says so ("21,400 SF marketed from Apr '27") instead of "0 SF available".
 */
export function availabilityFact(floor: FloorView, asOf: ISODate, safe: boolean): string {
  const coming = floorComing(floor, asOf, safe);
  if (floor.available > 0) return `${sf(floor.available)} available${coming ? ` · ${comingText(coming)}` : ''}`;
  return coming ? comingText(coming) : 'Nothing available';
}
