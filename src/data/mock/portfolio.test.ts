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
