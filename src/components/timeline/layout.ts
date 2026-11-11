import type { ISODate } from '../../domain/types';
import type { TimelineBar, TimelineModel, TimelineRow } from '../../domain/timeline';
import { addMonths, startOfMonth } from '../../domain/dates';

/** Pixel geometry shared by the view and the mini scrubber. */
export const LANE_PITCH = 26;
export const BAR_HEIGHT = 22;
export const ROW_PAD = 5;
export const MIN_ROW_HEIGHT = 32;

/** Stacked layout (narrow hosts): each bar is a thin bar under its own full label. */
export const STACK_LINE_H = 15;
export const STACK_BAR_H = 12;
/** Space between the last label line and the bar. */
export const STACK_LABEL_GAP = 3;
/** Space between one bar and the next label. */
export const STACK_LANE_GAP = 10;
export const STACK_ROW_PAD = 7;
/** A floor row is never shorter than its two-line gutter label. */
export const STACK_MIN_ROW_HEIGHT = 38;

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
  /** Top of each lane, measured from the top of the row. */
  laneTop: number[];
  top: number;
  height: number;
}

/** When a bar stops occupying its lane (open-ended bars hold the lane to the axis end). */
function occupiedUntil(bar: TimelineBar, asOf: ISODate, safe: boolean, keepsLane?: (bar: TimelineBar) => boolean): ISODate {
  if (bar.end === null || bar.kind === 'available' || bar.kind === 'forsale') return '9999-12-31';
  // A bar whose label has to be written to its right (an ended lease too short to say "vacated" on itself).
  if (keepsLane?.(bar)) return '9999-12-31';
  // Prospect-safe: a holdover's term is not disclosed, so its bar fades open-ended past the cursor.
  if (safe && (bar.kind === 'holdover' || bar.kind === 'mtm')) return '9999-12-31';
  // Holdover and projected bars are drawn out to the cursor.
  // A holdover keeps the rest of its lane: its tag and full label are written to the right of the bar.
  if (bar.kind === 'holdover') return '9999-12-31';
  if (bar.kind === 'projected' && bar.end < asOf) return asOf;
  return bar.end;
}

/**
 * Greedy interval packing: each bar takes the first lane that is free at its start. `keepsLane` names
 * the bars that keep the rest of their lane free, for a label written to the right of the bar.
 */
export function packLanes(bars: TimelineBar[], asOf: ISODate, safe = false, keepsLane?: (bar: TimelineBar) => boolean): TimelineBar[][] {
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
    free[i] = occupiedUntil(bar, asOf, safe, keepsLane);
  }
  return lanes;
}

/** Rows with their lanes, vertical position and height, stacked from `top`. */
export function layoutRows(rows: TimelineRow[], asOf: ISODate, top: number, safe = false, keepsLane?: (bar: TimelineBar) => boolean): LaidOutRow[] {
  let y = top;
  return rows.map((row) => {
    const lanes = packLanes(row.bars, asOf, safe, keepsLane);
    const height = Math.max(MIN_ROW_HEIGHT, Math.max(1, lanes.length) * LANE_PITCH + ROW_PAD * 2 - (LANE_PITCH - BAR_HEIGHT));
    const out = { row, lanes, laneTop: lanes.map((_, li) => ROW_PAD + li * LANE_PITCH), top: y, height };
    y += height;
    return out;
  });
}

/** Height of one stacked lane: its label lines, then the bar. */
export const stackedLaneHeight = (lines: number) => Math.max(1, lines) * STACK_LINE_H + STACK_LABEL_GAP + STACK_BAR_H;

/**
 * Rows for a host too narrow to label a bar inside it. Every bar takes a lane of its own, in
 * start order, and each lane is as tall as its label needs (`linesOf`), so a long tenant name
 * wraps onto a second line instead of being cut at the edge.
 */
export function layoutStackedRows(rows: TimelineRow[], top: number, linesOf: (bar: TimelineBar) => number): LaidOutRow[] {
  let y = top;
  return rows.map((row) => {
    const bars = row.bars.slice().sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.key < b.key ? -1 : 1));
    const laneTop: number[] = [];
    let at = STACK_ROW_PAD;
    for (const bar of bars) {
      laneTop.push(at);
      at += stackedLaneHeight(linesOf(bar)) + STACK_LANE_GAP;
    }
    const height = Math.max(STACK_MIN_ROW_HEIGHT, bars.length ? at - STACK_LANE_GAP + STACK_ROW_PAD : 0);
    const out = { row, lanes: bars.map((b) => [b]), laneTop, top: y, height };
    y += height;
    return out;
  });
}

export const rowsHeight = (laid: LaidOutRow[]) => laid.reduce((s, r) => s + r.height, 0);
