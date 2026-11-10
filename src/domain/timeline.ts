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
  /**
   * Prospect-safe: this is a lease's bar and its dates are withheld. `start` and `end` are the chart's
   * own (a lease in place runs in from before the axis and has no end; a signed lease runs on from the
   * as-of date) and must never be printed as dates of the lease.
   */
  datesWithheld?: boolean;
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
 *
 * Prospect-safe (`safe`, with floors from `safeFloors`): no bar is placed by a lease's dates. Every
 * lease in place is the same bar, in from the left edge and open-ended; a signed lease runs on from
 * the as-of date; leases that have already ended are not drawn. Space on offer keeps its own dates.
 */
export function timelineModel(p: Property, floors: FloorView[], asOf: ISODate, today: ISODate, safe = false): TimelineModel {
  const views = new Map(floors.map((f) => [f.floor.id, f]));
  const rows: TimelineRow[] = p.floors
    .slice()
    .sort((a, b) => b.sequence - a.sequence)
    .map((floor) => {
      const segs = views.get(floor.id)?.segments ?? [];
      const bars = segs.flatMap((s) => barFor(s, asOf));
      // History: leases on this floor that ended before the as-of date are no longer segments,
      // but their term still happened. Draw them as ended bars on whatever occupies the suite now.
      // A prospect is shown no lease's end, an ended one included.
      const horizon = addMonths(today, -12);
      for (const l of safe ? [] : p.leases) {
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
  for (const row of rows) for (const bar of row.bars) if (bar.start !== OPEN_START && bar.start < start) start = startOfMonth(bar.start);
  // A lease in place whose dates are withheld began "before the chart": one month left of the axis, so
  // every such bar is cut square at the left edge, the way a long-running lease is.
  const before = addMonths(start, -1);
  for (const row of rows) row.bars = row.bars.map((bar) => (bar.start === OPEN_START ? { ...bar, start: before } : bar));

  return { start, end: addMonths(asOf, 120), rows };
}

/** Placeholder start of a bar that runs in from before the axis (replaced once the axis is known). */
const OPEN_START = '';

function barFor(s: FloorView['segments'][number], asOf: ISODate): TimelineBar[] {
  const isLeaseBar = isLeaseKind(s.kind) || s.kind === 'committed' || s.kind === 'projected';
  if (isLeaseBar && s.lease) {
    // Prospect-safe (`safeFloors` marks the segment): the lease's dates are withheld, so a lease in
    // place is the chart's open-ended lease bar (`mtm`, no end), which runs past the as-of line and
    // fades. Every lease in place is drawn that way, so the bars say nothing about which lease began
    // or ends when. A signed lease keeps its hatched bar, from the as-of date on.
    const withheld = !!s.termWithheld;
    const headEnd = withheld ? null : leaseEnd(s.lease);
    const bars: TimelineBar[] = [
      {
        key: `tl-${s.key}`,
        segKey: s.key,
        label: s.lease.tenant,
        start: withheld ? (s.kind === 'committed' ? asOf : OPEN_START) : s.lease.commencement,
        end: headEnd,
        // the head lease stays a lease bar; the sublease itself is drawn as its own bar below
        kind: withheld ? (s.kind === 'committed' ? 'committed' : 'mtm') : s.kind === 'sublease' ? 'leased' : s.kind,
        sublease: false,
        committed: s.kind === 'committed',
        ...(withheld ? { datesWithheld: true } : {}),
      },
    ];
    // Sublease: its own bar from the availability date to the sublease expiration. When it runs to the
    // head lease's own end, the head bar simply becomes the (dotted) sublease bar: one suite, one bar.
    // With the head lease's dates withheld there is no end to compare: the sublease always has its own bar.
    const subEnd = s.availability ? (s.availability.subleaseExpiration ?? headEnd) : null;
    if (s.kind === 'sublease' && s.availability && !withheld && subEnd === leaseEnd(s.lease)) {
      bars[0] = { ...bars[0], end: subEnd, kind: 'sublease', sublease: true };
    } else if (s.kind === 'sublease' && s.availability) {
      bars.push({
        key: `tl-${s.key}-sub`,
        segKey: s.key,
        label: `Sublease · Ste ${s.suite ?? '—'}`,
        start: s.availability.availableFrom ?? asOf,
        end: subEnd,
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

