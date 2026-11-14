import { describe, expect, it } from 'vitest';
import { ROW_H, ROW_H_MIN, fitRowHeight, rowGapFor } from './fitRows';

/** The height twelve rows take, with the gaps between them. */
const stackOf = (h: number, floors: number) => floors * (h + rowGapFor(h));

describe('rows fitted to the window', () => {
  it('a tall window keeps the full row', () => {
    expect(fitRowHeight(1200, 12)).toBe(ROW_H);
  });

  it('a 1100 px window shrinks the rows until twelve floors fit the room they have', () => {
    const room = 710;
    const h = fitRowHeight(room, 12);
    expect(h).toBeLessThan(ROW_H);
    expect(h).toBeGreaterThan(ROW_H_MIN);
    expect(stackOf(h, 12)).toBeLessThanOrEqual(room);
  });

  it('never goes under two lines of text: a short window or a tall building scrolls', () => {
    expect(fitRowHeight(510, 12)).toBe(ROW_H_MIN);
    expect(fitRowHeight(710, 22)).toBe(ROW_H_MIN);
  });

  it('with no page to measure (a test, a server) the rows are full height', () => {
    expect(fitRowHeight(0, 12)).toBe(ROW_H);
    expect(fitRowHeight(-300, 12)).toBe(ROW_H);
    expect(fitRowHeight(700, 0)).toBe(ROW_H);
  });
});
