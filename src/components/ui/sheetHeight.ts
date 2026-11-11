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
