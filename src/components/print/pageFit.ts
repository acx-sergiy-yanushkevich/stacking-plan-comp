/**
 * How the report's first page is made to fit one sheet, whatever the screen it is printed from.
 *
 * The plan used to be drawn at the width the browser window happened to give it and then scaled to
 * the paper. A wide window gave a flat plan and a narrow one a tall plan, so the same report was three
 * pages from one screen and four from another (and the plan was not drawn at all when the report was
 * printed from the app rather than from its preview: it was measured while hidden, at no width).
 *
 * Now the plan is always drawn `PLAN_WIDTH` px wide (`lib/useWidth` `FixedWidth`) and the page scales
 * it to the paper, so its printed height follows from the row height alone. `planRowHeight` gives the
 * row height that fits; `print.css` holds the first section to one sheet and shrinks the plan if it
 * would still not fit (a legend that wraps to a third row), so the footnote can never leave the page.
 */

const PX_PER_IN = 96;
const PX_PER_MM = PX_PER_IN / 25.4;
/** The `@page` margin of the report (`styles/print.css`), on every side. */
const MARGIN_MM = 12;

/** The printed page inside its margins: US Letter, landscape, in CSS px. */
export const PAGE = {
  width: 11 * PX_PER_IN - 2 * MARGIN_MM * PX_PER_MM,
  height: 8.5 * PX_PER_IN - 2 * MARGIN_MM * PX_PER_MM,
};

/** The width the report's plan is drawn at, in px of its own drawing. The page scales it to its width. */
export const PLAN_WIDTH = 1400;

/**
 * What stands round the plan on the first page, in px on paper: the running head, the cover head, the
 * six figures, a legend of two rows and a footnote of two lines (the prospect-safe one), with the
 * space between them. Measured in the print layout at the page's width.
 */
export const AROUND_PLAN = 279;

/** The stack's own geometry (`stack/StackView`): the gap under each floor and the 2 px under the last. */
const ROW_GAP = 6;
const PLAN_END = 2;

/** A floor row at its full height: the three lines of a block, and the small type a narrow one needs. */
export const ROW_MAX = 48;
/** Under this a block cannot hold its two lines; a taller building is scaled to the page instead. */
export const ROW_MIN = 30;

/**
 * The height, in drawing px, of a floor row in the printed plan: the tallest (up to `ROW_MAX`) at
 * which every floor, the legend and the footnote fit the first page. Twelve floors keep the full
 * height; a taller building gets shorter rows, down to `ROW_MIN`.
 */
export function planRowHeight(floors: number): number {
  if (floors <= 0) return ROW_MAX;
  // The paper's room for the plan, in the plan's own px (it is drawn PLAN_WIDTH wide and scaled to the page).
  const room = ((PAGE.height - AROUND_PLAN) * PLAN_WIDTH) / PAGE.width;
  const fit = Math.floor((room - PLAN_END + ROW_GAP) / floors - ROW_GAP);
  return Math.max(ROW_MIN, Math.min(ROW_MAX, fit));
}

/** The printed height of the plan, in px on paper, for a row height: what `planRowHeight` solves for. */
export function planHeightOnPaper(floors: number, rowHeight: number): number {
  return ((floors * (rowHeight + ROW_GAP) - ROW_GAP + PLAN_END) * PAGE.width) / PLAN_WIDTH;
}
