import { isLeaseKind, type FloorView, type Segment } from '../../domain/derive';
import { fmtMonthYearShort } from '../../domain/dates';
import { num, pct, plural, rateRange } from '../../domain/format';
import { stageLabel, stageRank, topDeal, type LensId } from '../../domain/lenses';
import { canShowDeals, canShowTenantRisk, rentVisible } from '../../domain/safe';
import type { DealStage, ISODate, LeaseType, RateUnit } from '../../domain/types';
import { availabilityFact, floorDeals, nextExpiry } from '../floor/floorData';
import { LARGEST_BLOCK } from '../plan/segmentText';

/**
 * What the plan says about a floor in words, so a model or a map is never read by colour alone. All of
 * it is built here, so the texts cannot disagree:
 *
 *   floorLabelParts  the one label of a floor in a lens, in parts: its number, its leased share, the space
 *                    on offer (direct or sublease), what the lens adds, and whether it holds the largest
 *                    block. The list beside the Building view's model and the Map view's floor list both
 *                    print it through `FloorLabelText`, so a floor reads the same in both.
 *   lensFact         what the lens adds to the label; `lensDetail` is the same with nothing left out for
 *                    width, for a tooltip; `expirySpan` is the fact behind the expiration lens's words
 *   floorLabelText   those parts as the one line both lists print ("12 · 50.0% leased · 9,300 SF available")
 *   floorLabel       the label's accessible name ("Floor 8, 65.4% leased, 7,400 SF available"); the docked
 *                    picker's rows use it too
 *   spaceOf          the space a tenant could take today, saying when it is a sublease
 *   floorSentence    the full line: the caption above the model, a floor's tooltip
 *   floorHeading     what stands beside an open floor's name (its size; the cards under it carry the rest)
 *   labelNote        what the labels show in the active lens, for the caption line
 *
 * Prospect-safe keeps to what a prospect may see: space on the market and its asking rents.
 */

/**
 * The space a tenant could take on the floor today, in exact SF. Direct space is the plain case
 * ("9,300 SF available"). Sublease space is named, because a floor can be fully leased and still have
 * it ("7,000 SF sublease available"); a floor with both gives the total and its split
 * ("5,000 SF available (4,000 direct + 1,000 sublease)"). Empty when there is none.
 */
export function spaceOf(f: Pick<FloorView, 'available' | 'segments'>): string {
  if (f.available <= 0) return '';
  const sublease = Math.min(f.available, f.segments.filter((s) => s.kind === 'sublease').reduce((t, s) => t + s.size, 0));
  const direct = f.available - sublease;
  if (sublease === 0) return `${num(f.available)} SF available`;
  if (direct === 0) return `${num(sublease)} SF sublease available`;
  return `${num(f.available)} SF available (${num(direct)} direct + ${num(sublease)} sublease)`;
}

interface Rate {
  low: number;
  high: number;
  unit: RateUnit;
  type: LeaseType;
}

const TYPE_ORDER: LeaseType[] = ['FSG', 'MG', 'NNN'];

/**
 * Rates as exact ranges, one per lease type and rate unit: a gross rent is never put in a range with
 * a net one, nor a monthly rate with an annual one. "$29.75–$32/SF/yr FSG", "$42/SF/yr NNN".
 */
function ranges(rates: Rate[]): string[] {
  const groups = new Map<string, Rate>();
  for (const r of rates) {
    const key = `${r.type}/${r.unit}`;
    const g = groups.get(key);
    if (g) {
      g.low = Math.min(g.low, r.low);
      g.high = Math.max(g.high, r.high);
    } else groups.set(key, { ...r });
  }
  return [...groups.values()]
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || b.unit.localeCompare(a.unit))
    .map((g) => rateRange(g.low, g.high, g.unit, g.type));
}

/** The leases in place whose rent a label may give: a rent on record, not confidential; none in prospect-safe mode. */
export function inPlaceSegments(f: FloorView, safe: boolean): Segment[] {
  return f.segments.filter((s) => !!s.lease && isLeaseKind(s.kind) && s.lease.rate !== null && rentVisible(s.lease, safe));
}

/** Recorded in-place rents on the floor, one range per lease type and unit; confidential leases are left out, and all of them in prospect-safe mode. */
function inPlaceRents(f: FloorView, safe: boolean): string[] {
  return ranges(inPlaceSegments(f, safe).map((s) => ({ low: s.lease!.rate!, high: s.lease!.rate!, unit: s.lease!.rateUnit, type: s.lease!.leaseType })));
}

/** The space on offer today (direct and sublease) that has an asking rent to give. */
export function askingSegments(f: FloorView, safe: boolean): Segment[] {
  return f.segments.filter((s) => !!s.availability && (s.kind === 'available' || s.kind === 'sublease') && s.availability.rentHigh > 0 && rentVisible(s.availability, safe));
}

/** Asking rents of the space on offer today, one range per lease type and unit. */
function askingRents(f: FloorView, safe: boolean): string[] {
  return ranges(askingSegments(f, safe).map((s) => ({ low: s.availability!.rentLow, high: s.availability!.rentHigh, unit: s.availability!.rateUnit, type: s.availability!.leaseType })));
}

/**
 * The rents of a floor in words, every figure saying which rent it is: "asking" for the space on offer
 * today, "in place" for what a tenant pays. A label names the asking rent of the space it has just named
 * ("9,300 SF available · asking $38–$40/SF/yr FSG"), and the in-place rent on a floor with no asking rent
 * to give ("in place $31/SF/yr FSG"); `both` gives the two together, for a tooltip. A prospect is given
 * asking rents only: `rentVisible` withholds every lease's rent.
 */
function rentWords(f: FloorView, safe: boolean, both: boolean): string {
  const asking = askingRents(f, safe).map((r) => `asking ${r}`);
  const inPlace = inPlaceRents(f, safe).map((r) => `in place ${r}`);
  return (both ? [...asking, ...inPlace] : asking.length > 0 ? asking : inPlace).join(' · ');
}

/**
 * The first and the last dated lease expiry on the floor, as of the plan's date: the lease the floor's
 * "Next expiry" figure names (`nextExpiry`) and the one that runs longest. Holdover and month-to-month
 * leases have no date ahead and are named by their state instead. Null when no lease on the floor has one.
 */
export function expirySpan(f: FloorView): { first: ISODate; last: ISODate } | null {
  const first = nextExpiry(f)?.endDate;
  if (!first) return null;
  let last = first;
  for (const s of f.segments) {
    if (!s.lease || !isLeaseKind(s.kind) || s.termWithheld || s.monthsToExpiry === null || s.monthsToExpiry < 0 || !s.endDate) continue;
    if (s.endDate > last) last = s.endDate;
  }
  return { first, last };
}

/**
 * The lease terms of a floor in words, for the expiration lens: "holdover" and "month-to-month", each by
 * its own name, then when its dated leases expire, "expires Mar '27", or from the first to the last where
 * they differ, "expires Apr '27 – Sep '28". Every floor with a lease in place says one of them, however
 * far off the date: a floor is never left to its colour.
 */
function expiryWords(f: FloorView): string {
  const words: string[] = [];
  if (f.segments.some((s) => s.kind === 'holdover')) words.push('holdover');
  if (f.segments.some((s) => s.kind === 'mtm')) words.push('month-to-month');
  const span = expirySpan(f);
  if (span) {
    const [first, last] = [fmtMonthYearShort(span.first), fmtMonthYearShort(span.last)];
    words.push(first === last ? `expires ${first}` : `expires ${first} – ${last}`);
  }
  return words.join(' · ');
}

/** A signed lease on the floor reached through its Lease Out deal (the Pipeline lens draws it as "Lease signed"). */
export const leaseSigned = (f: FloorView, safe: boolean): boolean => canShowDeals(safe) && f.segments.some((s) => s.kind === 'committed' && topDeal(s)?.stage === 'Lease Out');
/** The earlier name of `leaseSigned`, kept for the Map view's colors until its redesign lands. */
export const leaseDrafted = leaseSigned;

/** The furthest stage any live deal on the floor has reached; null when it has none, or none a prospect may be told of. */

export function furthestStage(f: FloorView, safe: boolean): DealStage | null {
  if (!canShowDeals(safe)) return null;
  const deals = floorDeals(f, safe);
  if (deals.length === 0) return null;
  return deals.reduce((a, b) => (stageRank(b.deal.stage) > stageRank(a.deal.stage) ? b : a)).deal.stage;
}

/**
 * The words the active lens adds about a floor, beyond its space: who is at risk (status), when its
 * leases expire (expiration), the live deals and how far they have gone (deals), the rent (rent).
 * Empty when the lens has nothing to say, or nothing a prospect may be told. It always follows a " · "
 * in a label, so it starts in lower case in every lens ("holdover", "expires Mar '27", "asking $38…").
 */
export function lensFact(f: FloorView, lens: LensId, safe: boolean): string {
  switch (lens) {
    case 'status': {
      if (!canShowTenantRisk(safe)) return '';
      const words: string[] = [];
      if (f.segments.some((s) => s.kind === 'holdover')) words.push('holdover');
      if (f.segments.some((s) => s.kind === 'mtm')) words.push('month-to-month');
      if (f.segments.some((s) => s.kind === 'leased' && s.monthsToExpiry !== null && s.monthsToExpiry < 12)) words.push('expires < 12 mo');
      return words.join(' · ');
    }
    case 'expiry':
      return canShowTenantRisk(safe) ? expiryWords(f) : '';
    case 'deals': {
      const furthest = furthestStage(f, safe);
      // A signed lease reached through its Lease Out deal is drawn in that step's color: the label says so too,
      // in the legend's words ("Lease signed"), so the floor's color is never the only sign of it (round 22).
      const parts = [furthest ? `${plural(floorDeals(f, safe).length, 'live deal')} · ${stageLabel(furthest)}` : '', leaseSigned(f, safe) ? 'lease signed' : ''];
      return parts.filter(Boolean).join(' · ');
    }
    case 'rent':
      return rentWords(f, safe, false);
  }
}

/**
 * The lens fact with nothing left out for width, for a tooltip. It differs from the label's fact in the
 * rent lens only: a floor with space on offer gives its asking rent and its in-place rent
 * ("asking $38–$40/SF/yr FSG · in place $36/SF/yr FSG"), where the label keeps to the asking rent.
 */
export function lensDetail(f: FloorView, lens: LensId, safe: boolean): string {
  return lens === 'rent' ? rentWords(f, safe, true) : lensFact(f, lens, safe);
}

const leasedShare = (f: FloorView): number => (f.leasable > 0 ? f.leased / f.leasable : 0);

/** The one label of a floor in a lens, in the parts both floor lists print, in this order. */
export interface FloorLabelParts {
  /** "12" */
  number: string;
  /** "50.0% leased" */
  leased: string;
  /** "9,300 SF available", "7,000 SF sublease available"; empty when the floor has no space on offer. */
  space: string;
  /** What the lens adds: "holdover", "expires Mar '27", "1 live deal · Proposal", "asking $38–$40/SF/yr FSG"; empty when nothing. */
  fact: string;
  /** The floor holds the building's largest block: the label carries the "Largest block" tag. */
  largest: boolean;
}

/**
 * A floor's label in a lens. This is the only place the label is put together: the Building view's list
 * and the Map view's list both render these parts (FloorLabelText), so the same floor never reads two ways.
 */
export function floorLabelParts(f: FloorView, lens: LensId, safe: boolean, largest = false): FloorLabelParts {
  return { number: f.floor.name.replace(/^Floor\s+/i, ''), leased: `${pct(leasedShare(f))} leased`, space: spaceOf(f), fact: lensFact(f, lens, safe), largest };
}

/** The label as the one line both lists print: "12 · 50.0% leased · 9,300 SF available Largest block". */
export function floorLabelText(p: FloorLabelParts): string {
  return `${[p.number, p.leased, p.space, p.fact].filter(Boolean).join(' · ')}${p.largest ? ` ${LARGEST_BLOCK}` : ''}`;
}

/**
 * What the labels beside the floors show in the active lens, as the end of the caption line
 * ("Labels: …"). It names what the last part is, so a label without it reads as "none", not as missing data.
 */
export function labelNote(lens: LensId, safe: boolean): string {
  const base = '% leased · space available now';
  if (lens === 'rent') return `${base} · ${safe ? 'the asking rent of the space on offer' : 'the asking rent of the space on offer, else the in-place rent (confidential leases left out)'}`;
  if (lens === 'deals' && canShowDeals(safe)) return `${base} · live deals and the furthest stage reached`;
  if (lens === 'expiry' && canShowTenantRisk(safe)) return `${base} · holdover or month-to-month · lease expiry, first to last`;
  if (lens === 'status' && canShowTenantRisk(safe)) return `${base} · holdover, month-to-month or an expiry within 12 months`;
  return base;
}

/**
 * A floor label's accessible name: "Floor 8, 65.4% leased, 7,400 SF available", then the lens fact, then
 * "largest block" on the floor that holds the building's largest block. The same parts as the label.
 */
export function floorLabel(f: FloorView, lens: LensId, safe: boolean, largest = false): string {
  const p = floorLabelParts(f, lens, safe, largest);
  return [f.floor.name, p.leased, p.space, p.fact, p.largest ? 'largest block' : ''].filter(Boolean).join(', ');
}

/**
 * The full line about a floor: "21,400 RSF leasable · 65.4% leased · 7,400 SF available". A floor
 * with nothing free today but space coming to market says when ("21,400 SF marketed from Apr '27").
 */
export function floorSentence(f: FloorView, asOf: string, safe: boolean): string {
  const space = f.available === 0 ? availabilityFact(f, asOf, safe) : spaceOf(f);
  return `${num(f.leasable)} RSF leasable · ${pct(leasedShare(f))} leased · ${space === 'Nothing available' ? '0 SF available' : space}`;
}

/**
 * What stands beside an open floor's name: its size, and nothing else. The cards under the plate carry
 * the leased share, the space available and, for a floor with nothing free today, when it comes to
 * market ("0 SF · 21,400 SF marketed from Apr '27" in the Available card), so the heading repeats none of it.
 */
export function floorHeading(f: FloorView): string {
  return `${num(f.leasable)} RSF leasable`;
}
