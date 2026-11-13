import { describe, expect, it } from 'vitest';
import { LIVE_STACK, PORTFOLIO } from './portfolio';
import { BUILDINGS } from './buildings';

describe('portfolio sample entries', () => {
  it('have unique ids and names, and none is the live building', () => {
    expect(new Set(PORTFOLIO.map((b) => b.id)).size).toBe(PORTFOLIO.length);
    expect(new Set(PORTFOLIO.map((b) => b.name)).size).toBe(PORTFOLIO.length);
    expect(PORTFOLIO.map((b) => b.id)).not.toContain('P001');
  });

  it('draw four floors whose suites fill each floor, with the open suite on a real floor and suite', () => {
    for (const d of [...BUILDINGS.map((b) => b.stack), ...PORTFOLIO]) {
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
    const all = [...BUILDINGS.map((b) => b.stack), ...PORTFOLIO];
    for (const b of all) expect(sameFloors(b.floors, MARK.floors)).toBe(false);
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) expect(sameFloors(all[i].floors, all[j].floors) && all[i].open.join() === all[j].open.join(), `${i} vs ${j}`).toBe(false);
  });
});

describe('building icon colours', () => {
  // The icons wear the plan's palette (Clara, Nov 12: the reference she chose): pink-red, slate navy, green,
  // purple, teal and sky blue. Never the orange, which is each icon's open suite, nor the mark's own cyan.
  const PALETTE = ['#ef4b6c', '#4b5d8e', '#1fa36b', '#8d6bb0', '#1f97ab', '#45b0e2'];
  it('draws every building icon in a colour of the plan palette', () => {
    for (const d of [...BUILDINGS.map((b) => b.stack), ...PORTFOLIO]) expect(PALETTE, d.tone).toContain(d.tone);
  });
  it('gives the four buildings that open four different colours', () => {
    expect(new Set(BUILDINGS.map((b) => b.stack.tone)).size).toBe(BUILDINGS.length);
  });
  it('never uses the open suite\'s orange or the Stax cyan', () => {
    for (const d of [...BUILDINGS.map((b) => b.stack), ...PORTFOLIO]) for (const c of ['#ff9c00', '#00aff0']) expect(d.tone).not.toBe(c);
  });
});
