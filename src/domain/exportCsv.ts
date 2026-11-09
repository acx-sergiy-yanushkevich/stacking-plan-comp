import type { ISODate, Property } from './types';
import { activeDeals, isLeaseKind, leaseEnd, type FloorView, type Segment, type SegmentKind } from './derive';
import { rentVisible, tenantLabel } from './safe';
import { fmtDate, fmtMonths } from './dates';
import { num, rate as fmtRate, rateRange, usd0 } from './format';

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
  const header = safe ? RENT_ROLL_HEADER.filter((h) => h !== 'Live deals') : [...RENT_ROLL_HEADER];
  const rows: string[][] = [[...header]];
  for (const f of floors) {
    for (const s of f.segments) {
      if (s.kind === 'unmarketed') continue;
      const r = segmentRow(f, s, safe);
      rows.push(safe ? r.slice(0, -1) : r);
    }
  }
  // Leases xRE holds without a floor or unit are still part of the rent roll: list them, flagged.
  for (const l of unplacedLeases(p, asOf)) {
    const r = [l.floorId ? (p.floors.find((f) => f.id === l.floorId)?.name ?? '') : '', '', tenantLabel(l, safe), '', 'Not placed (data issue)', l.commencement, leaseEnd(l) ?? '', '', rentVisible(l, safe) && l.rate !== null ? String(l.rate) : '', rentVisible(l, safe) && l.rate !== null ? l.rateUnit : '', l.leaseType, '0'];
    rows.push(safe ? r.slice(0, -1) : r);
  }
  return rows;
}

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
    // The sublease is the marketed record: its own dates and asking rent, not the head lease's.
    tenant = lease ? tenantLabel(lease, safe) : '';
    commencement = avail.availableFrom ?? '';
    expiration = avail.subleaseExpiration ?? s.endDate ?? '';
    leaseType = avail.leaseType;
    if (rentVisible(avail, safe)) {
      rate = `${avail.rentLow}–${avail.rentHigh}`;
      unit = avail.rateUnit;
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
  const months = risk ? (safe ? '' : s.kind === 'holdover' ? 'Holdover' : 'MTM') : s.monthsToExpiry === null ? '' : String(Math.max(0, s.monthsToExpiry));
  const live = activeDeals(s.lease?.deals).length + activeDeals(s.availability?.deals).length + activeDeals(s.marketed?.deals).length;

  const state = safe && risk ? 'Leased (term withheld)' : STATE_LABEL[s.kind];
  if (safe && risk) expiration = '';
  return [f.floor.name, s.suite ?? '', tenant, String(s.size), state, commencement, expiration, months, rate, unit, leaseType, String(live)];
}

export const RENT_ROLL_DISPLAY_HEADER = ['Floor', 'Suite', 'Tenant', 'RSF', 'State', 'Commencement', 'Expiration', 'Remaining', 'Rate / price', 'Live deals'] as const;

/**
 * The same rent roll, formatted for reading (print layout): thousands separators,
 * long dates, "Holdover" / "MTM" instead of month counts, rates with unit and type,
 * asking prices for sale units. Drops the Live deals column in prospect-safe mode.
 */
export function rentRollDisplay(p: Property, floors: FloorView[], asOf: ISODate, safe: boolean): string[][] {
  const header = safe ? RENT_ROLL_DISPLAY_HEADER.filter((h) => h !== 'Live deals') : [...RENT_ROLL_DISPLAY_HEADER];
  const rows: string[][] = [[...header]];
  for (const f of floors) {
    for (const s of f.segments) {
      if (s.kind === 'unmarketed') continue;
      const lease = isLeaseKind(s.kind) || s.kind === 'committed' || s.kind === 'projected' ? s.lease : undefined;
      const a = s.availability;
      let tenant = '—';
      let start = '—';
      let end = '—';
      let rate = '—';
      if (s.kind === 'sublease' && a) {
        tenant = lease ? `${tenantLabel(lease, safe)} (sublandlord)` : 'Sublease';
        start = a.availableFrom ? fmtDate(a.availableFrom) : 'Now';
        end = a.subleaseExpiration ? fmtDate(a.subleaseExpiration) : s.endDate ? fmtDate(s.endDate) : '—';
        rate = rentVisible(a, safe) ? `Asking ${rateRange(a.rentLow, a.rentHigh, a.rateUnit, a.leaseType)}` : '—';
      } else if (lease) {
        tenant = tenantLabel(lease, safe);
        start = fmtDate(lease.commencement);
        end = s.endDate ? fmtDate(s.endDate) : 'Month-to-month';
        rate = rentVisible(lease, safe) && lease.rate !== null ? fmtRate(lease.rate, lease.rateUnit, lease.leaseType) : safe ? 'Withheld' : lease.confidential ? 'Confidential' : '—';
      } else if (a) {
        tenant = s.kind === 'forsale' ? 'For sale' : 'Available';
        start = s.availableFrom ? fmtDate(s.availableFrom) : 'Now';
        end = '—';
        if (s.kind === 'forsale') rate = rentVisible(a, safe) && a.askingPrice ? `${usd0(a.askingPrice)} · ${usd0(Math.round(a.askingPrice / s.size))}/SF` : '—';
        else rate = rentVisible(a, safe) && a.rentHigh > 0 ? `Asking ${rateRange(a.rentLow, a.rentHigh, a.rateUnit, a.leaseType)}` : '—';
      }
      const risk = s.kind === 'holdover' || s.kind === 'mtm';
      const remaining = risk ? (safe ? '—' : s.kind === 'holdover' ? 'Holdover' : 'MTM') : s.monthsToExpiry === null ? '—' : fmtMonths(Math.max(0, s.monthsToExpiry));
      if (safe && risk) end = '—';
      const live = activeDeals(s.lease?.deals).length + activeDeals(s.availability?.deals).length + activeDeals(s.marketed?.deals).length;
      const row = [f.floor.name, s.suite ?? '—', tenant, num(s.size), safe && risk ? 'Leased (term withheld)' : STATE_LABEL[s.kind], start, end, remaining, rate, live ? String(live) : '—'];
      rows.push(safe ? row.slice(0, -1) : row);
    }
  }
  for (const l of unplacedLeases(p, asOf)) {
    const end = leaseEnd(l);
    const row = [l.floorId ? (p.floors.find((f) => f.id === l.floorId)?.name ?? '—') : '—', '—', tenantLabel(l, safe), '—', 'Not placed (data issue)', fmtDate(l.commencement), end ? fmtDate(end) : 'Month-to-month', '—', rentVisible(l, safe) && l.rate !== null ? fmtRate(l.rate, l.rateUnit, l.leaseType) : safe ? 'Withheld' : '—', '—'];
    rows.push(safe ? row.slice(0, -1) : row);
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
