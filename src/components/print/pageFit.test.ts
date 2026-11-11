import { describe, expect, it } from 'vitest';
import { AROUND_PLAN, PAGE, PLAN_WIDTH, ROW_MAX, ROW_MIN, planHeightOnPaper, planRowHeight } from './pageFit';

describe('the printed page', () => {
  it('is US Letter, landscape, inside a 12 mm margin', () => {
    // 11 in × 8.5 in at 96 px to the inch, less 24 mm each way.
    expect(PAGE.width).toBeCloseTo(965.29, 1);
    expect(PAGE.height).toBeCloseTo(725.29, 1);
  });
});

describe('planRowHeight: the cover fits one page', () => {
  const room = PAGE.height - AROUND_PLAN;

  it('the twelve floors of the mock building keep the full row height', () => {
    expect(planRowHeight(12)).toBe(ROW_MAX);
    expect(planHeightOnPaper(12, planRowHeight(12))).toBeLessThanOrEqual(room);
  });

  it('whatever the number of floors, the plan it sizes fits the room the page leaves', () => {
    for (let floors = 1; floors <= 40; floors++) {
      const row = planRowHeight(floors);
      expect(row, `${floors} floors`).toBeGreaterThanOrEqual(ROW_MIN);
      expect(row, `${floors} floors`).toBeLessThanOrEqual(ROW_MAX);
      // Above the minimum the plan fits as drawn; at the minimum the page scales it (print.css).
      if (row > ROW_MIN) expect(planHeightOnPaper(floors, row), `${floors} floors`).toBeLessThanOrEqual(room);
    }
  });

  it('gives the tallest row that fits: one px more would not', () => {
    for (const floors of [13, 14, 16, 17]) {
      const row = planRowHeight(floors);
      expect(row).toBeLessThan(ROW_MAX);
      expect(row).toBeGreaterThan(ROW_MIN);
      expect(planHeightOnPaper(floors, row + 1), `${floors} floors`).toBeGreaterThan(room);
    }
  });

  it('a taller building gets shorter rows, never taller ones, and never under the minimum', () => {
    const rows = Array.from({ length: 40 }, (_, i) => planRowHeight(i + 1));
    for (let i = 1; i < rows.length; i++) expect(rows[i]).toBeLessThanOrEqual(rows[i - 1]);
    expect(planRowHeight(40)).toBe(ROW_MIN);
    expect(planRowHeight(0)).toBe(ROW_MAX);
  });

  it('the plan is drawn wider than the page and scaled down to it', () => {
    expect(PLAN_WIDTH).toBeGreaterThan(PAGE.width);
    // 12 rows of 48 px with 6 px between and 2 px under the last, scaled from 1400 px to the page.
    expect(planHeightOnPaper(12, 48)).toBeCloseTo((644 * PAGE.width) / 1400, 5);
  });
});
