// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { KPI_COLUMN_MIN_WINDOW, KPI_COLUMN_QUERY, kpisBesideModel } from './kpiPlacement';

describe('where the Building view\'s KPIs stand', () => {
  it('is a column beside the model where the card has room: a wide window with no inspector beside the plan', () => {
    expect(kpisBesideModel({ view: 'building', roomy: true, inspector: false })).toBe(true);
  });

  it('is the strip above the plan on a tablet, with the inspector open, and in every other view', () => {
    expect(kpisBesideModel({ view: 'building', roomy: false, inspector: false })).toBe(false);
    expect(kpisBesideModel({ view: 'building', roomy: true, inspector: true })).toBe(false);
    for (const view of ['stack', 'timeline', 'map', 'floor']) expect(kpisBesideModel({ view, roomy: true, inspector: false })).toBe(false);
  });

  it('does not ask whether a floor is open: opening or closing one cannot move the KPIs', () => {
    // The rule's whole input. Nothing here names a floor, a selection or a filter.
    const input = { view: 'building', roomy: true, inspector: false };
    expect(Object.keys(input).sort()).toEqual(['inspector', 'roomy', 'view']);
    expect(kpisBesideModel.length).toBe(1);
  });

  it('calls a window roomy from 1212 px: a card of 1180 px inside the app\'s 16 px margins', () => {
    expect(KPI_COLUMN_MIN_WINDOW - 2 * 16).toBe(1180);
    expect(KPI_COLUMN_QUERY).toBe('(min-width: 1212px)');
  });
});
