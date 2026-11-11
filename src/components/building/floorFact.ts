import { isLeaseKind, type FloorView } from '../../domain/derive';
import { fmtMonthYearShort } from '../../domain/dates';
import { num, pct, plural, rateRange } from '../../domain/format';
import { stageRank, type LensId } from '../../domain/lenses';
import { canShowDeals, canShowTenantRisk, rentVisible } from '../../domain/safe';
import type { LeaseType, RateUnit } from '../../domain/types';
import { availabilityFact, floorDeals } from '../floor/floorData';
import { LARGEST_BLOCK } from '../plan/segmentText';

/**
 * What the plan says about a floor in words, so a model or a map is never read by colour alone. All of
 * it is built here, so the texts cannot disagree:
 *
 *   floorLabelParts  the one label of a floor in a lens, in parts: its number, its leased share, the space
 *                    on offer (direct or sublease), what the lens adds, and whether it holds the largest
 *                    block. The list beside the Building view's model and the Map view's floor list both
 *                    print it through `FloorLabelText`, so a floor reads the same in both.
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
 * a net one, nor a monthly rate with an annual one. "$29.75–$32/SF/yr FSG · $42/SF/yr NNN".
 */
function ranges(rates: Rate[]): string {
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
    .map((g) => rateRange(g.low, g.high, g.unit, g.type))
    .join(' · ');
}

/** Recorded in-place rents on the floor, by lease type; confidential leases are left out, and all of them in prospect-safe mode. */
function inPlaceRents(f: FloorView, safe: boolean): string {
  const rates: Rate[] = [];
  for (const s of f.segments) {
    const l = s.lease;
    if (!l || !isLeaseKind(s.kind) || l.rate === null || !rentVisible(l, safe)) continue;
    rates.push({ low: l.rate, high: l.rate, unit: l.rateUnit, type: l.leaseType });
  }
  return ranges(rates);
}

/** Asking rents of the space on offer today (direct and sublease), by lease type. */
function askingRents(f: FloorView, safe: boolean): string {
  const rates: Rate[] = [];
  for (const s of f.segments) {
    const a = s.availability;
    if (!a || (s.kind !== 'available' && s.kind !== 'sublease') || a.rentHigh <= 0 || !rentVisible(a, safe)) continue;
    rates.push({ low: a.rentLow, high: a.rentHigh, unit: a.rateUnit, type: a.leaseType });
  }
  return ranges(rates);
}

/**
 * The words the active lens adds about a floor, beyond its space: who is at risk (status), the next
 * expiry (expiration), the live deals and how far they have gone (deals), the rents (rent).
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
    case 'expiry': {
      if (!canShowTenantRisk(safe)) return '';
      const soon = f.segments
        .filter((s) => (s.kind === 'leased' || s.kind === 'sublease') && s.endDate && s.monthsToExpiry !== null && s.monthsToExpiry <= 24)
        .sort((a, b) => a.monthsToExpiry! - b.monthsToExpiry!)[0];
      const risk = f.segments.some((s) => s.kind === 'holdover' || s.kind === 'mtm');
      return risk ? 'holdover / MTM' : soon ? `expires ${fmtMonthYearShort(soon.endDate!)}` : '';
    }
    case 'deals': {
      if (!canShowDeals(safe)) return '';
      const deals = floorDeals(f, safe);
      if (deals.length === 0) return '';
      const furthest = deals.reduce((a, b) => (stageRank(b.deal.stage) > stageRank(a.deal.stage) ? b : a)).deal.stage;
      return `${plural(deals.length, 'live deal')} · ${furthest}`;
    }
    case 'rent': {
      const inPlace = inPlaceRents(f, safe);
      if (inPlace) return inPlace;
      const asking = askingRents(f, safe);
      return asking ? `asking ${asking}` : '';
    }
  }
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
  /** What the lens adds: "holdover", "expires Mar '27", "1 live deal · Proposal", "$36/SF/yr FSG"; empty when nothing. */
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
  if (lens === 'rent') return `${base} · ${safe ? 'the asking rent of the space on offer' : 'in-place rent by lease type (confidential leases left out), else the asking rent'}`;
  if (lens === 'deals' && canShowDeals(safe)) return `${base} · live deals and the furthest stage reached`;
  if (lens === 'expiry' && canShowTenantRisk(safe)) return `${base} · the next lease expiry within 24 months (no date: none in that window)`;
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
