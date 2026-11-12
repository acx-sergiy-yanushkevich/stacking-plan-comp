import { describe, expect, it } from 'vitest';
import { LIVE_STACK, PORTFOLIO } from './portfolio';

describe('portfolio sample entries', () => {
  it('have unique ids and names, and none is the live building', () => {
    expect(new Set(PORTFOLIO.map((b) => b.id)).size).toBe(PORTFOLIO.length);
    expect(new Set(PORTFOLIO.map((b) => b.name)).size).toBe(PORTFOLIO.length);
    expect(PORTFOLIO.map((b) => b.id)).not.toContain('P001');
  });

  it('draw four floors whose suites fill each floor, with the open suite on a real floor and suite', () => {
    for (const d of [LIVE_STACK, ...PORTFOLIO]) {
      expect(d.floors).toHaveLength(4);
      for (const f of d.floors) expect(f.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
      expect(d.floors[d.open[0]]?.[d.open[1]]).toBeDefined();
      expect(d.tone).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

/** The Stax mark's own drawing (Brand.tsx), in the switcher's terms: the product's logo, not a building's icon. */
const MARK = { floors: [[1], [0.62, 0.38], [0.36, 0.64], [1]], open: [1, 1], tone: '#00aff0' };
const sameFloors = (a: ReadonlyArray<ReadonlyArray<number>>, b: ReadonlyArray<ReadonlyArray<number>>) =>
  a.length === b.length && a.every((f, i) => f.length === b[i].length && f.every((s, j) => Math.abs(s - b[i][j]) < 0.05));

describe('building icons in the switcher', () => {
  it('the live building does not wear the Stax mark: another layout and another colour', () => {
    expect(sameFloors(LIVE_STACK.floors, MARK.floors)).toBe(false);
    expect(LIVE_STACK.tone).not.toBe(MARK.tone);
  });

  it('no building draws the mark, and no two buildings draw the same icon', () => {
    const all = [LIVE_STACK, ...PORTFOLIO];
    for (const b of all) expect(sameFloors(b.floors, MARK.floors)).toBe(false);
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) expect(sameFloors(all[i].floors, all[j].floors) && all[i].open.join() === all[j].open.join(), `${i} vs ${j}`).toBe(false);
  });
});
