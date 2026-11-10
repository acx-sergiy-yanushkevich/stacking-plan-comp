import { isLeaseKind, type FloorView } from '../../domain/derive';
import { fmtMonthYearShort } from '../../domain/dates';
import { num, pct, plural, rateRange } from '../../domain/format';
import { stageRank, type LensId } from '../../domain/lenses';
import { canShowDeals, canShowTenantRisk, rentVisible } from '../../domain/safe';
import type { LeaseType, RateUnit } from '../../domain/types';
import { availabilityFact, floorDeals } from '../floor/floorData';

/**
 * What the building model and its floor picker say about a floor in words, so neither is read by
 * colour alone. Three texts, all built here so they cannot disagree:
 *
 *   floorFact      the few words printed after the floor number on the model ("7,400 SF available")
 *   floorLabel     the picker row's accessible name and tooltip ("Floor 8, 65.4% leased, 7,400 SF available")
 *   floorSentence  the full line under the model and beside an open floor
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

/** The fact printed after the floor number on the model: the one thing the active lens colours by, in a few words. */
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

/** What the facts beside the floors are, in the active lens: a blank then reads as "none", not as missing data. */
export function factNote(lens: LensId, safe: boolean): string {
  if (lens === 'rent')
    return safe
      ? 'Beside each floor: the asking rent of the space on offer.'
      : 'Beside each floor: recorded in-place rent by lease type (confidential leases left out); the asking rent where no rent is in place.';
  if (lens === 'deals' && canShowDeals(safe)) return 'Beside each floor: its live deals and the furthest stage any has reached.';
  if (lens === 'expiry' && canShowTenantRisk(safe)) return 'Beside each floor: its next lease expiry within 24 months of the as-of date. No date means none in that window.';
  return canShowTenantRisk(safe) && lens === 'status'
    ? 'Beside each floor: space available now, then holdover, month-to-month or an expiry within 12 months where one applies.'
    : 'Beside each floor: space available now.';
}

const leasedShare = (f: FloorView): number => (f.leasable > 0 ? f.leased / f.leasable : 0);

/** A picker row's accessible name and tooltip: "Floor 8, 65.4% leased, 7,400 SF available", then the lens fact. */
export function floorLabel(f: FloorView, lens: LensId, safe: boolean): string {
  return [f.floor.name, `${pct(leasedShare(f))} leased`, spaceOf(f), lensFact(f, lens, safe)].filter(Boolean).join(', ');
}

/**
 * The full line about a floor: "21,400 RSF leasable · 65.4% leased · 7,400 SF available". A floor
 * with nothing free today but space coming to market says when ("21,400 SF marketed from Apr '27").
 */
export function floorSentence(f: FloorView, asOf: string, safe: boolean): string {
  const space = f.available === 0 ? availabilityFact(f, asOf, safe) : `${num(f.available)} SF available`;
  return `${num(f.leasable)} RSF leasable · ${pct(leasedShare(f))} leased · ${space === 'Nothing available' ? '0 SF available' : space}`;
}
