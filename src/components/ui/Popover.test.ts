// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { shiftIntoWindow, tabMove } from './Popover';

describe('shiftIntoWindow', () => {
  it('leaves a panel that is inside the window where it is', () => {
    expect(shiftIntoWindow(12, 304, 390)).toBe(0);
    expect(shiftIntoWindow(8, 382, 390)).toBe(0);
  });

  it('brings back a panel that hangs off the left edge (the Export menu on a 390 px phone was at -34 to 258)', () => {
    expect(shiftIntoWindow(-34, 258, 390)).toBe(42);
    expect(-34 + shiftIntoWindow(-34, 258, 390)).toBe(8);
  });

  it('brings back a panel that hangs off the right edge', () => {
    expect(shiftIntoWindow(40, 404, 390)).toBe(-22);
  });

  it('keeps the left edge of a panel wider than the window in view', () => {
    expect(shiftIntoWindow(18, 382, 360)).toBe(-10);
  });
});

describe('tabMove', () => {
  it('a panel of text alone is left by Tab and by Shift+Tab: it closes and focus goes on from its trigger (round 23)', () => {
    expect(tabMove(0, -1, false)).toBe('leave');
    expect(tabMove(0, -1, true)).toBe('leave');
  });

  it('a panel of controls keeps its Tab cycle: last to first, first (or the panel) to last', () => {
    expect(tabMove(3, 2, false)).toBe('first');
    expect(tabMove(3, 0, true)).toBe('last');
    expect(tabMove(3, -1, true)).toBe('last');
    expect(tabMove(3, 0, false)).toBeNull();
    expect(tabMove(3, 2, true)).toBeNull();
    expect(tabMove(1, 0, false)).toBe('first');
  });
});
