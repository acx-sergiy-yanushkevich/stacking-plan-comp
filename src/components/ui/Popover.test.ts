// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { shiftIntoWindow } from './Popover';

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
