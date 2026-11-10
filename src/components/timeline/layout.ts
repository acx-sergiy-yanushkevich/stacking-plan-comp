import type { ISODate } from '../../domain/types';
import type { TimelineBar, TimelineModel, TimelineRow } from '../../domain/timeline';
import { addMonths, startOfMonth } from '../../domain/dates';

/** Pixel geometry shared by the view and the mini scrubber. */
export const LANE_PITCH = 26;
export const BAR_HEIGHT = 22;
export const ROW_PAD = 5;
export const MIN_ROW_HEIGHT = 32;

export interface Axis {
  start: ISODate;
  end: ISODate;
}

/**
 * The visible axis. The domain axis begins at the earliest commencement in view, which
 * can be a decade of history that says nothing about rollover; the view shows at most
 * 24 months before the earlier of today and as-of and lets older bars run off the left
 * edge (their tooltips carry the real start). The end is the domain's as-of + 10 years.
 */
export function viewAxis(t: TimelineModel, asOf: ISODate, today: ISODate): Axis {
  const floor = startOfMonth(addMonths(asOf < today ? asOf : today, -24));
  return { start: t.start > floor ? t.start : floor, end: t.end };
}

export interface LaidOutRow {
  row: TimelineRow;
  /** Bars packed into lanes: bars in one lane never overlap in time. */
  lanes: TimelineBar[][];
  top: number;
  height: number;
}

/** When a bar stops occupying its lane (open-ended bars hold the lane to the axis end). */
function occupiedUntil(bar: TimelineBar, asOf: ISODate, safe: boolean): ISODate {
  if (bar.end === null || bar.kind === 'available' || bar.kind === 'forsale') return '9999-12-31';
  // Prospect-safe: a holdover's term is not disclosed, so its bar fades open-ended past the cursor.
  if (safe && (bar.kind === 'holdover' || bar.kind === 'mtm')) return '9999-12-31';
  // Holdover and projected bars are drawn out to the cursor.
  // A holdover keeps the rest of its lane: its tag and full label are written to the right of the bar.
  if (bar.kind === 'holdover') return '9999-12-31';
  if (bar.kind === 'projected' && bar.end < asOf) return asOf;
  return bar.end;
}

/** Greedy interval packing: each bar takes the first lane that is free at its start. */
export function packLanes(bars: TimelineBar[], asOf: ISODate, safe = false): TimelineBar[][] {
  const sorted = bars.slice().sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.key < b.key ? -1 : 1));
  const lanes: TimelineBar[][] = [];
  const free: ISODate[] = [];
  for (const bar of sorted) {
    let i = free.findIndex((f) => f <= bar.start);
    if (i === -1) {
      i = lanes.length;
      lanes.push([]);
      free.push('');
    }
    lanes[i].push(bar);
    free[i] = occupiedUntil(bar, asOf, safe);
  }
  return lanes;
}

/** Rows with their lanes, vertical position and height, stacked from `top`. */
export function layoutRows(rows: TimelineRow[], asOf: ISODate, top: number, safe = false): LaidOutRow[] {
  let y = top;
  return rows.map((row) => {
    const lanes = packLanes(row.bars, asOf, safe);
    const height = Math.max(MIN_ROW_HEIGHT, Math.max(1, lanes.length) * LANE_PITCH + ROW_PAD * 2 - (LANE_PITCH - BAR_HEIGHT));
    const out = { row, lanes, top: y, height };
    y += height;
    return out;
  });
}

export const rowsHeight = (laid: LaidOutRow[]) => laid.reduce((s, r) => s + r.height, 0);
