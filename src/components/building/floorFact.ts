import type { FloorView } from '../../domain/derive';
import { fmtMonthYearShort } from '../../domain/dates';
import { num, plural } from '../../domain/format';
import type { LensId } from '../../domain/lenses';
import { liveDeals } from '../floor/floorData';

/**
 * The one fact about a floor that the active lens colours by, in a few words, so the building model
 * and its floor picker can be read without relying on colour. Prospect-safe keeps to what a prospect
 * may see: space on the market.
 */
export function floorFact(f: FloorView, lens: LensId, safe: boolean): string {
  const space = f.available > 0 ? `${num(f.available)} SF available` : '';
  if (safe || lens === 'status' || lens === 'rent') return space;
  if (lens === 'expiry') {
    const soon = f.segments
      .filter((s) => (s.kind === 'leased' || s.kind === 'sublease') && s.endDate && s.monthsToExpiry !== null && s.monthsToExpiry <= 24)
      .sort((a, b) => a.monthsToExpiry! - b.monthsToExpiry!)[0];
    const risk = f.segments.some((s) => s.kind === 'holdover' || s.kind === 'mtm');
    return risk ? 'Holdover / MTM' : soon ? `Expires ${fmtMonthYearShort(soon.endDate!)}` : '';
  }
  const deals = liveDeals(f).length;
  return deals ? `${plural(deals, 'live deal')}` : '';
}
