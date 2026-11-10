/**
 * Where the building's six KPIs stand in the Building view.
 *
 * One rule, asked by the app (which shows or hides the strip above the plan) and by the view (which
 * draws the column): the KPIs are a column beside the model where the plan card has room for three
 * columns (the KPIs, the model with its picker, an open floor's pane), and the strip above the plan
 * everywhere else. Room means a card of about 1180 px or more: a window of 1212 px and up (the app's
 * 16 px margins) with no inspector standing beside the plan.
 *
 * Whether a floor is open is deliberately not part of the rule. Opening or closing a floor therefore
 * never moves the KPIs or the toolbar under them, and the KPI a keyboard user pressed is still there.
 */
export const KPI_COLUMN_MIN_WINDOW = 1212;
export const KPI_COLUMN_QUERY = `(min-width: ${KPI_COLUMN_MIN_WINDOW}px)`;

export interface KpiPlacementInput {
  /** The view on screen. */
  view: string;
  /** The window is wide enough (`KPI_COLUMN_QUERY`). */
  roomy: boolean;
  /** The inspector stands beside the plan and takes 372 px of the card's room. */
  inspector: boolean;
}

/** True when the KPIs are the column beside the model; false when they are the strip above the plan. */
export function kpisBesideModel({ view, roomy, inspector }: KpiPlacementInput): boolean {
  return view === 'building' && roomy && !inspector;
}
