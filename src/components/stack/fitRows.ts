/** A floor's row at full size, and the shortest it is drawn to keep the whole building in the window. */
export const ROW_H = 72;
export const ROW_H_MIN = 44;
/** The room between rows, and between rows fitted to under 56 px. */
export const ROW_GAP = 6;
export const ROW_GAP_TIGHT = 4;
/** Under this height a row is "tight": two lines of text, and the rows stand closer together. */
export const ROW_TIGHT_UNDER = 56;

export const rowGapFor = (rowH: number): number => (rowH < ROW_TIGHT_UNDER ? ROW_GAP_TIGHT : ROW_GAP);

/**
 * The row height at which every floor is in the window at once. A stacking plan is read whole, and at
 * 72 px a row a 12-floor building ran two screens on a laptop. Rows shrink from 72 px toward 44 px (two
 * lines of text: the name, then suite, SF and the lens fact on one line) and never further, so a short
 * window or a tall building scrolls rather than lose its labels.
 *
 * `room` is the height the rows may take together: the window's height less everything above the plan's
 * first row and the padding under its last. No room known (no page, a test) is the full height.
 */
export function fitRowHeight(room: number, floors: number): number {
  if (!(room > 0) || floors <= 0) return ROW_H;
  const each = Math.floor(room / floors);
  const h = each - rowGapFor(each - ROW_GAP);
  return Math.max(ROW_H_MIN, Math.min(ROW_H, h));
}
