import { describe, expect, it } from 'vitest';
import { floorKept, isToolPanel, openArea, TOOL_CLOSE } from './actions';
import type { PlanState } from '../../state/planState';

describe('tool panels and the open floor (round 18)', () => {
  it('the Floor view and the Building view keep their floor; the other views drop it', () => {
    expect(floorKept('floor', 'F6')).toBe('F6');
    expect(floorKept('building', 'F8')).toBe('F8');
    for (const v of ['stack', 'timeline', 'map']) expect(floorKept(v, 'F6'), v).toBeNull();
  });

  it('opening Area takes the floor it is given and clears the finder and worklist filters', () => {
    let next: Partial<PlanState> = {};
    openArea((p) => (next = p), 'F6');
    expect(next).toMatchObject({ mode: 'area', floor: 'F6', select: null, req: null, window: null, inquiry: null });
    openArea((p) => (next = p));
    expect(next.floor).toBeNull();
  });

  it('each tool panel closes to the building and drops the filters it set; the brief and the plan panels are not tools', () => {
    for (const m of ['find', 'worklist', 'issues', 'area']) {
      expect(isToolPanel(m), m).toBe(true);
      expect(TOOL_CLOSE[m as keyof typeof TOOL_CLOSE].mode).toBe('building');
    }
    expect(TOOL_CLOSE.find).toMatchObject({ req: null, max: null, by: null, inquiry: null });
    expect(TOOL_CLOSE.worklist).toMatchObject({ window: null });
    for (const m of ['brief', 'building', 'floor', 'block']) expect(isToolPanel(m), m).toBe(false);
  });
});
