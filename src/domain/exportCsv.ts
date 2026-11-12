import type { ISODate, Property } from './types';
import { activeDeals, isLeaseKind, leaseEnd, type FloorView, type Segment, type SegmentKind } from './derive';
import { canShowDeals, canShowInPlaceRent, canShowIssues, canShowLeaseTerm, canShowTenantRisk, leaseDatesHidden, rentVisible, tenantLabel, termHidden } from './safe';
import { fmtDate, fmtMonths } from './dates';
import { num, rate as fmtRate, rateRange, usd, usd0 } from './format';

export const RENT_ROLL_HEADER = [
  'Floor',
  'Suite',
  'Tenant',
  'RSF',
  'State',
  'Commencement',
  'Expiration',
  'Months remaining',
  'Rate',
  'Unit',
  'Lease type',
  'Live deals',
] as const;

const STATE_LABEL: Record<SegmentKind, string> = {
  leased: 'Leased',
  holdover: 'Holdover',
  mtm: 'Month-to-month',
  available: 'Available',
  sublease: 'Sublease',
  committed: 'Signed, not yet in',
  projected: 'Projected vacancy',
  unmarketed: 'Unmarketed',
  forsale: 'For sale',
};

/**
 * Rent roll rows for the as-of date: header first, then one row per segment
 * (top floor first, left to right). Unmarketed gaps are not records, so they are
 * skipped. RSF is the exact number, never formatted. Rates carry no `$` so the
 * CSV opens as numbers; the Unit column says `yr`/`mo`. In prospect-safe mode the Live deals column
 * is dropped (deal activity is not for prospects), no lease has a commencement, an expiration or
 * months remaining, whether it is in place ("Leased") or signed and not yet in ("Signed, not yet in"), and a
 * sublet suite is written as the space on offer: its asking rent with unit and lease type, and no end
 * date (a sublease ends with its sublandlord's lease), the same facts the prospect-safe PDF prints
 * for it. The file is a rent roll: it carries no building-wide figure (no WALT, no rollover) in any mode.
 */
export function rentRollRows(p: Property, floors: FloorView[], asOf: ISODate, safe: boolean): string[][] {
  const rows: string[][] = [dealColumn([...RENT_ROLL_HEADER], safe)];
  for (const f of floors) {
    for (const s of f.segments) {
      if (s.kind === 'unmarketed') continue;
      rows.push(dealColumn(segmentRow(f, s, safe), safe));
    }
  }
  // Leases xRE holds without a floor or unit are still part of the rent roll: list them, flagged (owner outputs only).
  for (const l of unplacedRows(p, asOf, safe)) {
    const r = [l.floorId ? (p.floors.find((f) => f.id === l.floorId)?.name ?? '') : '', '', tenantLabel(l, safe), '', 'Not placed (data issue)', l.commencement, leaseEnd(l) ?? '', '', rentVisible(l, safe) && l.rate !== null ? String(l.rate) : '', rentVisible(l, safe) && l.rate !== null ? l.rateUnit : '', l.leaseType, '0'];
    rows.push(dealColumn(r, safe));
  }
  return rows;
}

/** The last column of every rent-roll row is Live deals: dropped when deal activity is withheld. */
const dealColumn = (row: string[], safe: boolean): string[] => (canShowDeals(safe) ? row : row.slice(0, -1));

/** Unplaced leases are a data issue: listed on owner outputs only. */
const unplacedRows = (p: Property, asOf: ISODate, safe: boolean) => (canShowIssues(safe) ? unplacedLeases(p, asOf) : []);

/** Active leases that cannot be drawn: no Unit records, or no Floor. */
export function unplacedLeases(p: Property, asOf: ISODate) {
  return p.leases.filter((l) => (l.units.length === 0 || !l.floorId) && l.commencement <= asOf && (!leaseEnd(l) || leaseEnd(l)! >= asOf));
}

function segmentRow(f: FloorView, s: Segment, safe: boolean): string[] {
  const lease = isLeaseKind(s.kind) || s.kind === 'committed' || s.kind === 'projected' ? s.lease : undefined;
  const avail = s.availability;

  let tenant = '';
  let commencement = '';
  let expiration = '';
  let rate = '';
  let unit = '';
  let leaseType = '';

  if (s.kind === 'sublease' && avail) {
    // The head lease is the rent-roll record (its own commencement, end and in-place rent); the sublease
    // asking rent is a marketing fact and lives in the display's State cell.
    tenant = lease ? tenantLabel(lease, safe) : '';
    commencement = lease?.commencement ?? '';
    expiration = s.endDate ?? '';
    leaseType = lease?.leaseType ?? avail.leaseType;
    if (lease && rentVisible(lease, safe) && lease.rate !== null) {
      rate = String(lease.rate);
      unit = lease.rateUnit;
    } else if (!canShowInPlaceRent(safe) && rentVisible(avail, safe) && avail.rentHigh > 0) {
      // Prospect-safe: the head lease's rent and term are withheld, which would leave the suite's asking
      // rent out of the file while the PDF prints it. Asking rents are marketing information: the row
      // carries the offer instead (asking range, its unit and type).
      rate = `${avail.rentLow}–${avail.rentHigh}`;
      unit = avail.rateUnit;
      leaseType = avail.leaseType;
    }
  } else if (lease) {
    tenant = tenantLabel(lease, safe);
    commencement = lease.commencement;
    expiration = s.endDate ?? '';
    leaseType = lease.leaseType;
    if (rentVisible(lease, safe) && lease.rate !== null) {
      rate = String(lease.rate);
      unit = lease.rateUnit;
    }
  } else if (avail) {
    if (s.kind === 'forsale') {
      if (rentVisible(avail, safe) && avail.askingPrice !== undefined) rate = String(avail.askingPrice);
    } else {
      leaseType = avail.leaseType;
      if (rentVisible(avail, safe)) {
        rate = `${avail.rentLow}–${avail.rentHigh}`;
        unit = avail.rateUnit;
      }
    }
  }

  // Prospect-safe: no lease has a commencement, an expiration or months remaining, so a holdover or a
  // month-to-month lease cannot be found by its empty cells and no lease can be dated by when it began.
  const hidden = leaseDatesHidden(s.kind, safe);
  const risk = s.kind === 'holdover' || s.kind === 'mtm';
  const months = hidden ? '' : risk ? (s.kind === 'holdover' ? 'Holdover' : 'MTM') : s.monthsToExpiry === null ? '' : String(Math.max(0, s.monthsToExpiry));
  // A sublet suite included: a sublease's end is its sublandlord's lease end (`domain/safe.ts`, rule 2).
  const expirationOut = hidden ? '' : expiration;
  const live = activeDeals(s.lease?.deals).length + activeDeals(s.availability?.deals).length + activeDeals(s.marketed?.deals).length;

  const state = stateLabel(s, safe);
  return [f.floor.name, s.suite ?? '', tenant, String(s.size), state, hidden ? '' : commencement, expirationOut, months, rate, unit, leaseType, String(live)];
}

/** The State cell: prospect-safe shows every lease in place as "Leased" (a sublet suite stays "Sublease"). */
const stateLabel = (s: Segment, safe: boolean): string => (termHidden(s.kind, safe) && s.kind !== 'sublease' ? 'Leased' : STATE_LABEL[s.kind]);

export const RENT_ROLL_DISPLAY_HEADER = ['Floor', 'Suite', 'Tenant', 'RSF', 'State', 'Commencement', 'Expiration', 'Remaining', 'Rate / price', 'Live deals'] as const;

/**
 * The same rent roll, formatted for reading (print layout): thousands separators,
 * long dates, "Holdover" / "MTM" instead of month counts, rates with unit and type,
 * asking prices for sale units. In prospect-safe mode the Live deals column is dropped and so are the
 * three lease-date columns (Commencement, Expiration, Remaining): what is left of them is one
 * "Available from" column, filled only for space on offer. A sublet suite is space on offer there: it
 * reads "Sublease", available now (or from its date), with its asking rent in the rate column and no
 * end date and no word about whose lease it is cut from.
 */
export function rentRollDisplay(p: Property, floors: FloorView[], asOf: ISODate, safe: boolean): string[][] {
  const rows: string[][] = [displayColumns([...RENT_ROLL_DISPLAY_HEADER], safe, true)];
  for (const f of floors) {
    for (const s of f.segments) {
      if (s.kind === 'unmarketed') continue;
      const lease = isLeaseKind(s.kind) || s.kind === 'committed' || s.kind === 'projected' ? s.lease : undefined;
      const a = s.availability;
      const hidden = leaseDatesHidden(s.kind, safe);
      let tenant = '—';
      let start = '—';
      let end = '—';
      let rate = '—';
      let stateExtra = '';
      if (s.kind === 'sublease' && a && hidden) {
        // Prospect-safe: the row is the offer. The start column is "Available from", the rate column the asking rent.
        tenant = lease ? tenantLabel(lease, safe) : 'Sublease';
        start = a.availableFrom && a.availableFrom > asOf ? fmtDate(a.availableFrom) : 'Now';
        rate = rentVisible(a, safe) && a.rentHigh > 0 ? `Asking ${rateRange(a.rentLow, a.rentHigh, a.rateUnit, a.leaseType)}` : '—';
      } else if (s.kind === 'sublease' && a) {
        tenant = lease ? `${tenantLabel(lease, safe)} (sublandlord)` : 'Sublease';
        start = lease ? fmtDate(lease.commencement) : a.availableFrom ? fmtDate(a.availableFrom) : 'Now';
        // The Expiration column is the head lease's; the sublease's own end is in the State cell.
        end = s.endDate ? fmtDate(s.endDate) : '—';
        rate = lease && rentVisible(lease, safe) && lease.rate !== null ? fmtRate(lease.rate, lease.rateUnit, lease.leaseType) : lease?.confidential ? 'Confidential' : '—';
        stateExtra = rentVisible(a, safe) ? ` · asking ${rateRange(a.rentLow, a.rentHigh, a.rateUnit, a.leaseType)}${a.subleaseExpiration ? ` thru ${fmtDate(a.subleaseExpiration)}` : ''}` : '';
      } else if (lease) {
        tenant = tenantLabel(lease, safe);
        start = hidden ? '—' : fmtDate(lease.commencement);
        end = hidden ? '—' : s.endDate ? fmtDate(s.endDate) : canShowTenantRisk(safe) ? 'Month-to-month' : '—';
        rate = rentVisible(lease, safe) && lease.rate !== null ? fmtRate(lease.rate, lease.rateUnit, lease.leaseType) : !canShowInPlaceRent(safe) ? '—' : lease.confidential ? 'Confidential' : '—';
      } else if (a) {
        tenant = s.kind === 'forsale' ? 'For sale' : 'Available';
        start = s.availableFrom ? fmtDate(s.availableFrom) : 'Now';
        end = '—';
        if (s.kind === 'forsale') rate = rentVisible(a, safe) && a.askingPrice ? `${usd0(a.askingPrice)} · ${usd(a.askingPrice / s.size)}/SF` : '—';
        else rate = rentVisible(a, safe) && a.rentHigh > 0 ? `Asking ${rateRange(a.rentLow, a.rentHigh, a.rateUnit, a.leaseType)}` : '—';
      }
      const risk = s.kind === 'holdover' || s.kind === 'mtm';
      const remaining = hidden ? '—' : risk ? (s.kind === 'holdover' ? 'Holdover' : 'MTM') : s.monthsToExpiry === null ? '—' : fmtMonths(Math.max(0, s.monthsToExpiry));
      const live = activeDeals(s.lease?.deals).length + activeDeals(s.availability?.deals).length + activeDeals(s.marketed?.deals).length;
      const row = [f.floor.name, s.suite ?? '—', tenant, num(s.size), stateLabel(s, safe) + stateExtra, start, end, remaining, rate, live ? String(live) : '—'];
      rows.push(displayColumns(row, safe));
    }
  }
  for (const l of unplacedRows(p, asOf, safe)) {
    const end = leaseEnd(l);
    const row = [l.floorId ? (p.floors.find((f) => f.id === l.floorId)?.name ?? '—') : '—', '—', tenantLabel(l, safe), '—', 'Not placed (data issue)', fmtDate(l.commencement), end ? fmtDate(end) : 'Month-to-month', '—', rentVisible(l, safe) && l.rate !== null ? fmtRate(l.rate, l.rateUnit, l.leaseType) : '—', '—'];
    rows.push(displayColumns(row, safe));
  }
  return rows;
}

/**
 * The display columns a reader may see. With lease terms withheld, Expiration and Remaining go and
 * the start column is headed "Available from": a lease's row has a dash there, space on offer its date.
 */
function displayColumns(row: string[], safe: boolean, header = false): string[] {
  const out = dealColumn(row, safe);
  if (canShowLeaseTerm(safe)) return out;
  return [...out.slice(0, 5), header ? 'Available from' : out[5], ...out.slice(8)];
}

/** Display columns that hold figures (right-aligned in the printed table), by their heading. */
export const RENT_ROLL_NUMERIC: ReadonlySet<string> = new Set(['RSF', 'Remaining', 'Live deals']);

/** RFC 4180: quote cells containing comma, quote or newline; double internal quotes; CRLF rows. */
export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
