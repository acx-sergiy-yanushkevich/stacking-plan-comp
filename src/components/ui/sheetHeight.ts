/**
 * The heights of the bottom sheet, as shares of the window's height: its half snap, and the most it may
 * take when expanded (ui.css holds the same two figures for the sheet before it has been measured).
 */
export const SHEET_HALF = 0.48;
export const SHEET_MOST = 0.92;

/** An expanded sheet that would be less than this much taller than the half snap is not worth a control. */
export const SHEET_MIN_GROWTH = 16;

export interface SheetMeasure {
  /** The window's height, px. */
  viewport: number;
  /** What the sheet's content needs to show without scrolling, its handle and heading included; null before it is measured. */
  content: number | null;
  /** The strip at the top of the window that must stay uncovered (the selection the sheet was opened for, with its air); null when there is none. */
  keepClear: number | null;
}

/**
 * The height of the expanded sheet, px: as tall as its content, and no taller. It never takes more than
 * 92% of the window, never covers the strip that is to stay clear, and is never shorter than the half snap.
 */
export function expandedSheetHeight({ viewport, content, keepClear }: SheetMeasure): number {
  const half = SHEET_HALF * viewport;
  const most = Math.min(SHEET_MOST * viewport, keepClear === null ? Infinity : viewport - keepClear);
  return Math.max(half, Math.floor(Math.min(content === null ? most : Math.ceil(content), most)));
}

/** Whether expanding shows more than the half snap already does: the content is longer, and there is room to grow into. */
export function canExpandSheet(m: SheetMeasure): boolean {
  return expandedSheetHeight(m) - SHEET_HALF * m.viewport >= SHEET_MIN_GROWTH;
}

/** A press on the handle that moves less than this far, px, is a tap (it toggles the sheet), not a drag. */
export const SHEET_DRAG_SLOP = 6;
/** A release faster than this, px per ms, is a flick: the sheet goes the way it was thrown, not to the nearer height. */
export const SHEET_FLICK = 0.5;

/** Whether a press on the handle that has moved `dy` px is a drag. */
export function isSheetDrag(dy: number): boolean {
  return Math.abs(dy) > SHEET_DRAG_SLOP;
}

/**
 * The sheet's height while its handle is dragged, px: the height it started at less the drag (`dy`, negative
 * upward), kept between the half snap and the expanded height, so a drag can never cover the selection.
 */
export function dragSheetHeight(start: number, dy: number, m: SheetMeasure): number {
  return Math.min(expandedSheetHeight(m), Math.max(SHEET_HALF * m.viewport, start - dy));
}

/** Where a released drag settles: a flick goes the way it was thrown (`velocity` in px per ms, negative upward); a slower drag to the nearer of the two heights. */
export function snapSheet(height: number, velocity: number, m: SheetMeasure): 'half' | 'full' {
  if (Math.abs(velocity) >= SHEET_FLICK) return velocity < 0 ? 'full' : 'half';
  const half = SHEET_HALF * m.viewport;
  return height - half > expandedSheetHeight(m) - height ? 'full' : 'half';
}
