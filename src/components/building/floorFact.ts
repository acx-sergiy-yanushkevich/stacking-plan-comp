import { isLeaseKind, type FloorView } from '../../domain/derive';
import { fmtMonthYearShort } from '../../domain/dates';
import { num, pct, plural, rateRange } from '../../domain/format';
import { stageRank, type LensId } from '../../domain/lenses';
import { canShowDeals, canShowTenantRisk, rentVisible } from '../../domain/safe';
import type { LeaseType, RateUnit } from '../../domain/types';
import { availabilityFact, floorDeals } from '../floor/floorData';

/**
 * What the Building view says about a floor in words, so the model is never read by colour alone. All of
 * it is built here, so the texts cannot disagree:
 *
 *   floorParts     what a floor's label beside the model prints after the floor number
 *                  ("65.4% leased", "7,400 SF available · holdover")
 *   floorLabel     the same label's accessible name ("Floor 8, 65.4% leased, 7,400 SF available"); the
 *                  docked picker's rows use it too
 *   floorSentence  the full line: the caption above the model, a floor's tooltip
 *   floorHeading   what stands beside an open floor's name (its size; the cards under it carry the rest)
 *   floorFact      a floor in one short fact, for the Map view's floor list
 *   labelNote      what the labels show in the active lens, for the caption line
 *
 * Prospect-safe keeps to what a prospect may see: space on the market and its asking rents.
 */

const spaceOf = (f: FloorView): string => (f.available > 0 ? `${num(f.available)} SF available` : '');

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
 * Empty when the lens has nothing to say, or nothing a prospect may be told.
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
      return risk ? 'Holdover / MTM' : soon ? `Expires ${fmtMonthYearShort(soon.endDate!)}` : '';
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
      return asking ? `Asking ${asking}` : '';
    }
  }
}

const leasedShare = (f: FloorView): number => (f.leasable > 0 ? f.leased / f.leasable : 0);

/** What a floor's label prints after its number: the leased share, then its space and what the active lens adds. */
export interface FloorParts {
  /** "65.4% leased" */
  leased: string;
  /** "7,400 SF available · holdover"; empty for a full floor the lens has nothing to say about. */
  fact: string;
}

export function floorParts(f: FloorView, lens: LensId, safe: boolean): FloorParts {
  return { leased: `${pct(leasedShare(f))} leased`, fact: [spaceOf(f), lensFact(f, lens, safe)].filter(Boolean).join(' · ') };
}

/**
 * A floor in a few words, for a row that has room for one short fact: the Map view's floor list
 * (map/mapStyle.ts `floorState`). The one thing the active lens colours by: space on offer and a risk
 * word (status), the next expiry, the live deals, the rents. The Building view's labels have the room
 * to say the space in every lens and use `floorParts`; both are built from `lensFact`, so they agree.
 */
export function floorFact(f: FloorView, lens: LensId, safe: boolean): string {
  const space = spaceOf(f);
  const fact = lensFact(f, lens, safe);
  // "5,500 SF available · holdover", or "Holdover" when it stands alone.
  if (lens === 'status') return space ? [space, fact].filter(Boolean).join(' · ') : fact.charAt(0).toUpperCase() + fact.slice(1);
  if (lens === 'rent') return fact;
  if (lens === 'deals') return fact;
  // Expiration: a prospect is shown the space on offer instead of who leaves when.
  return fact || (safe ? space : '');
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
 * "largest block" on the floor that holds the building's largest block.
 */
export function floorLabel(f: FloorView, lens: LensId, safe: boolean, largest = false): string {
  return [f.floor.name, `${pct(leasedShare(f))} leased`, spaceOf(f), lensFact(f, lens, safe), largest ? 'largest block' : ''].filter(Boolean).join(', ');
}

/**
 * The full line about a floor: "21,400 RSF leasable · 65.4% leased · 7,400 SF available". A floor
 * with nothing free today but space coming to market says when ("21,400 SF marketed from Apr '27").
 */
export function floorSentence(f: FloorView, asOf: string, safe: boolean): string {
  const space = f.available === 0 ? availabilityFact(f, asOf, safe) : `${num(f.available)} SF available`;
  return `${num(f.leasable)} RSF leasable · ${pct(leasedShare(f))} leased · ${space === 'Nothing available' ? '0 SF available' : space}`;
}

/**
 * What stands beside an open floor's name: its size. The cards under the plate carry the leased share
 * and the space available, so the heading does not say them again. A floor with nothing free today but
 * space coming to market keeps that phrase here ("21,400 SF marketed from Apr '27"): no card states it.
 */
export function floorHeading(f: FloorView, asOf: string, safe: boolean): string {
  const coming = f.available === 0 ? availabilityFact(f, asOf, safe) : '';
  return [`${num(f.leasable)} RSF leasable`, coming === 'Nothing available' ? '' : coming].filter(Boolean).join(' · ');
}
