import type { ISODate, Property } from './types';
import { activeDeals, isLeaseKind, leaseEnd, type FloorView, type Segment, type SegmentKind } from './derive';
import { canShowDeals, canShowInPlaceRent, canShowIssues, canShowTenantRisk, rentVisible, tenantLabel, termHidden } from './safe';
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
  committed: 'Committed',
  projected: 'Projected vacancy',
  unmarketed: 'Unmarketed',
  forsale: 'For sale',
};

/**
 * Rent roll rows for the as-of date: header first, then one row per segment
 * (top floor first, left to right). Unmarketed gaps are not records, so they are
 * skipped. RSF is the exact number, never formatted. Rates carry no `$` so the
 * CSV opens as numbers; the Unit column says `yr`/`mo`. In prospect-safe mode the
 * Live deals column is dropped (deal activity is not for prospects).
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

  const risk = s.kind === 'holdover' || s.kind === 'mtm';
  const months = risk ? (termHidden(s.kind, safe) ? '' : s.kind === 'holdover' ? 'Holdover' : 'MTM') : s.monthsToExpiry === null ? '' : String(Math.max(0, s.monthsToExpiry));
  const expirationOut = termHidden(s.kind, safe) ? '' : expiration;
  const live = activeDeals(s.lease?.deals).length + activeDeals(s.availability?.deals).length + activeDeals(s.marketed?.deals).length;

  // Prospect-safe: every in-place lease is simply "Leased" with its recorded dates, so no tenant stands out.
  const state = termHidden(s.kind, safe) ? 'Leased' : STATE_LABEL[s.kind];
  return [f.floor.name, s.suite ?? '', tenant, String(s.size), state, commencement, expirationOut, months, rate, unit, leaseType, String(live)];
}

export const RENT_ROLL_DISPLAY_HEADER = ['Floor', 'Suite', 'Tenant', 'RSF', 'State', 'Commencement', 'Expiration', 'Remaining', 'Rate / price', 'Live deals'] as const;

/**
 * The same rent roll, formatted for reading (print layout): thousands separators,
 * long dates, "Holdover" / "MTM" instead of month counts, rates with unit and type,
 * asking prices for sale units. Drops the Live deals column in prospect-safe mode.
 */
export function rentRollDisplay(p: Property, floors: FloorView[], asOf: ISODate, safe: boolean): string[][] {
  const rows: string[][] = [dealColumn([...RENT_ROLL_DISPLAY_HEADER], safe)];
  for (const f of floors) {
    for (const s of f.segments) {
      if (s.kind === 'unmarketed') continue;
      const lease = isLeaseKind(s.kind) || s.kind === 'committed' || s.kind === 'projected' ? s.lease : undefined;
      const a = s.availability;
      let tenant = '—';
      let start = '—';
      let end = '—';
      let rate = '—';
      let stateExtra = '';
      if (s.kind === 'sublease' && a) {
        tenant = lease ? `${tenantLabel(lease, safe)} (sublandlord)` : 'Sublease';
        start = lease ? fmtDate(lease.commencement) : a.availableFrom ? fmtDate(a.availableFrom) : 'Now';
        end = s.endDate ? fmtDate(s.endDate) : '—';
        rate = lease && rentVisible(lease, safe) && lease.rate !== null ? fmtRate(lease.rate, lease.rateUnit, lease.leaseType) : !canShowInPlaceRent(safe) ? 'Withheld' : lease?.confidential ? 'Confidential' : '—';
        stateExtra = rentVisible(a, safe) ? ` · asking ${rateRange(a.rentLow, a.rentHigh, a.rateUnit, a.leaseType)}${a.subleaseExpiration ? ` thru ${fmtDate(a.subleaseExpiration)}` : ''}` : '';
      } else if (lease) {
        tenant = tenantLabel(lease, safe);
        start = fmtDate(lease.commencement);
        end = termHidden(s.kind, safe) ? '—' : s.endDate ? fmtDate(s.endDate) : canShowTenantRisk(safe) ? 'Month-to-month' : '—';
        rate = rentVisible(lease, safe) && lease.rate !== null ? fmtRate(lease.rate, lease.rateUnit, lease.leaseType) : !canShowInPlaceRent(safe) ? 'Withheld' : lease.confidential ? 'Confidential' : '—';
      } else if (a) {
        tenant = s.kind === 'forsale' ? 'For sale' : 'Available';
        start = s.availableFrom ? fmtDate(s.availableFrom) : 'Now';
        end = '—';
        if (s.kind === 'forsale') rate = rentVisible(a, safe) && a.askingPrice ? `${usd0(a.askingPrice)} · ${usd(a.askingPrice / s.size)}/SF` : '—';
        else rate = rentVisible(a, safe) && a.rentHigh > 0 ? `Asking ${rateRange(a.rentLow, a.rentHigh, a.rateUnit, a.leaseType)}` : '—';
      }
      const risk = s.kind === 'holdover' || s.kind === 'mtm';
      const remaining = risk ? (termHidden(s.kind, safe) ? '—' : s.kind === 'holdover' ? 'Holdover' : 'MTM') : s.monthsToExpiry === null ? '—' : fmtMonths(Math.max(0, s.monthsToExpiry));
      const live = activeDeals(s.lease?.deals).length + activeDeals(s.availability?.deals).length + activeDeals(s.marketed?.deals).length;
      const row = [f.floor.name, s.suite ?? '—', tenant, num(s.size), (termHidden(s.kind, safe) ? 'Leased' : STATE_LABEL[s.kind]) + stateExtra, start, end, remaining, rate, live ? String(live) : '—'];
      rows.push(dealColumn(row, safe));
    }
  }
  for (const l of unplacedRows(p, asOf, safe)) {
    const end = leaseEnd(l);
    const row = [l.floorId ? (p.floors.find((f) => f.id === l.floorId)?.name ?? '—') : '—', '—', tenantLabel(l, safe), '—', 'Not placed (data issue)', fmtDate(l.commencement), end ? fmtDate(end) : 'Month-to-month', '—', rentVisible(l, safe) && l.rate !== null ? fmtRate(l.rate, l.rateUnit, l.leaseType) : '—', '—'];
    rows.push(dealColumn(row, safe));
  }
  return rows;
}

/** RFC 4180: quote cells containing comma, quote or newline; double internal quotes; CRLF rows. */
export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
