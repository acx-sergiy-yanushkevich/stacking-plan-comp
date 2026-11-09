import type { Floor, ISODate, Property } from './types';
import { addMonths, startOfMonth, yearOf } from './dates';
import { isLeaseKind, leaseEnd, type FloorView, type SegmentKind } from './derive';

export interface TimelineBar {
  key: string;
  segKey: string;
  label: string;
  start: ISODate;
  /** Null = open-ended (month-to-month lease or an availability with no end). */
  end: ISODate | null;
  kind: SegmentKind;
  sublease: boolean;
  committed: boolean;
}

export interface TimelineRow {
  floor: Floor;
  bars: TimelineBar[];
}

export interface TimelineModel {
  start: ISODate;
  end: ISODate;
  rows: TimelineRow[];
}

/**
 * Timeline rows (top floor first) with one bar per lease unit or availability
 * (DESIGN.md §2.5). Axis runs from the earliest commencement in view or
 * today − 12 months (whichever is earlier, snapped to the 1st) to as-of + 10 years.
 */
export function timelineModel(p: Property, floors: FloorView[], asOf: ISODate, today: ISODate): TimelineModel {
  const views = new Map(floors.map((f) => [f.floor.id, f]));
  const rows: TimelineRow[] = p.floors
    .slice()
    .sort((a, b) => b.sequence - a.sequence)
    .map((floor) => {
      const segs = views.get(floor.id)?.segments ?? [];
      const bars = segs.flatMap((s) => barFor(s, asOf));
      // History: leases on this floor that ended before the as-of date are no longer segments,
      // but their term still happened. Draw them as ended bars on whatever occupies the suite now.
      const horizon = addMonths(today, -12);
      for (const l of p.leases) {
        const end = leaseEnd(l);
        if (!end || end >= asOf || end < horizon) continue;
        for (const u of l.units) {
          if (u.floorId !== floor.id || segs.some((s) => s.key === u.id)) continue;
          const host = segs.find((s) => s.suite === u.suite) ?? segs[0];
          if (!host) continue;
          bars.push({ key: `tl-hist-${u.id}`, segKey: host.key, label: l.tenant, start: l.commencement, end, kind: 'projected', sublease: false, committed: false });
        }
      }
      return { floor, bars };
    });

  let start = startOfMonth(addMonths(today, -12));
  for (const row of rows) for (const bar of row.bars) if (bar.start < start) start = startOfMonth(bar.start);

  return { start, end: addMonths(asOf, 120), rows };
}

function barFor(s: FloorView['segments'][number], asOf: ISODate): TimelineBar[] {
  const isLeaseBar = isLeaseKind(s.kind) || s.kind === 'committed' || s.kind === 'projected';
  if (isLeaseBar && s.lease) {
    const bars: TimelineBar[] = [
      {
        key: `tl-${s.key}`,
        segKey: s.key,
        label: s.lease.tenant,
        start: s.lease.commencement,
        end: leaseEnd(s.lease),
        // the head lease stays a lease bar; the sublease itself is drawn as its own bar below
        kind: s.kind === 'sublease' ? 'leased' : s.kind,
        sublease: false,
        committed: s.kind === 'committed',
      },
    ];
    // Sublease: its own bar from the availability date to the sublease expiration.
    if (s.kind === 'sublease' && s.availability) {
      bars.push({
        key: `tl-${s.key}-sub`,
        segKey: s.key,
        label: `Sublease · Ste ${s.suite ?? '—'}`,
        start: s.availability.availableFrom ?? asOf,
        end: s.availability.subleaseExpiration ?? leaseEnd(s.lease),
        kind: 'sublease',
        sublease: true,
        committed: false,
      });
    }
    // Occupied but already marketed: the coming supply starts on its available-from date.
    if (s.marketed && s.marketed.kind === 'Lease' && !s.marketed.sublease) {
      bars.push({
        key: `tl-${s.key}-mkt`,
        segKey: s.key,
        label: `Available · Ste ${s.marketed.suite}`,
        start: s.marketed.availableFrom ?? asOf,
        end: null,
        kind: 'available',
        sublease: false,
        committed: false,
      });
    }
    // A signed replacement lease that has not started yet.
    if (s.next) {
      bars.push({
        key: `tl-${s.key}-next`,
        segKey: s.key,
        label: s.next.lease.tenant,
        start: s.next.lease.commencement,
        end: leaseEnd(s.next.lease),
        kind: 'committed',
        sublease: false,
        committed: true,
      });
    }
    return bars;
  }
  if (s.kind === 'available' || s.kind === 'forsale') {
    return [
      {
        key: `tl-${s.key}`,
        segKey: s.key,
        label: s.kind === 'forsale' ? 'For sale' : `Available · Ste ${s.suite ?? '—'}`,
        start: s.availableFrom ?? s.availability?.availableFrom ?? asOf,
        end: null,
        kind: s.kind,
        sublease: false,
        committed: false,
      },
    ];
  }
  return [];
}

/** Linear-by-day position of `d` on an axis of `width` px from `start` to `end`. */
export function dateToX(d: ISODate, start: ISODate, end: ISODate, width: number): number {
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (e <= s) return 0;
  return ((Date.parse(d) - s) / (e - s)) * width;
}

/** Inverse of `dateToX`, clamped to [start, end] and snapped to the nearest 1st of a month. */
export function xToDate(x: number, start: ISODate, end: ISODate, width: number): ISODate {
  const s = Date.parse(start);
  const e = Date.parse(end);
  const t = width > 0 ? Math.min(1, Math.max(0, x / width)) : 0;
  const ms = s + t * (e - s);
  const raw = new Date(ms).toISOString().slice(0, 10);
  const day = Number(raw.slice(8, 10));
  const daysInMonth = new Date(Date.UTC(Number(raw.slice(0, 4)), Number(raw.slice(5, 7)), 0)).getUTCDate();
  const snapped = day - 1 < daysInMonth / 2 ? startOfMonth(raw) : startOfMonth(addMonths(raw, 1));
  if (snapped < start) return start;
  if (snapped > end) return startOfMonth(end) >= start ? startOfMonth(end) : start;
  return snapped;
}

/** One tick per 1 January inside [start, end]. */
export function yearTicks(start: ISODate, end: ISODate): Array<{ date: ISODate; label: string }> {
  const ticks: Array<{ date: ISODate; label: string }> = [];
  for (let y = yearOf(start); y <= yearOf(end); y++) {
    const date = `${y}-01-01`;
    if (date >= start && date <= end) ticks.push({ date, label: String(y) });
  }
  return ticks;
}

