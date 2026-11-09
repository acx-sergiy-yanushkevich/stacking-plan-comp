import type { ISODate, Property } from './types';
import { activeDeals, isLeaseKind, type FloorView, type Segment, type SegmentKind } from './derive';
import { rentVisible, tenantLabel } from './safe';

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
 * CSV opens as numbers; the Unit column says `yr`/`mo`.
 */
export function rentRollRows(_p: Property, floors: FloorView[], _asOf: ISODate, safe: boolean): string[][] {
  const rows: string[][] = [[...RENT_ROLL_HEADER]];
  for (const f of floors) {
    for (const s of f.segments) {
      if (s.kind === 'unmarketed') continue;
      rows.push(segmentRow(f, s, safe));
    }
  }
  return rows;
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

  if (lease) {
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

  const months = s.monthsToExpiry === null ? '' : String(s.monthsToExpiry);
  const live = activeDeals(s.lease?.deals).length + activeDeals(s.availability?.deals).length + activeDeals(s.marketed?.deals).length;

  return [
    f.floor.name,
    s.suite ?? '',
    tenant,
    String(s.size),
    STATE_LABEL[s.kind],
    commencement,
    expiration,
    months,
    rate,
    unit,
    leaseType,
    String(live),
  ];
}

/** RFC 4180: quote cells containing comma, quote or newline; double internal quotes; CRLF rows. */
export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
