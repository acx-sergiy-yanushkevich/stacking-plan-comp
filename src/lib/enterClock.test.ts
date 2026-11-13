import { describe, expect, it } from 'vitest';
import { enterShift } from './enterClock';

describe('enterShift', () => {
  it('starts a fresh entrance on a view switch', () => {
    const first = enterShift(null, 'stack:pp', 'e1', 100);
    expect(first).toEqual({ enter: 'stack:pp', epoch: 'e1', at: 100, shift: 0 });
    const next = enterShift(first, 'timeline:pp', 'e1', 900);
    expect(next.shift).toBe(0);
    expect(next.at).toBe(900);
    expect(next.enter).toBe('timeline:pp');
  });

  it('continues the entrance when the stage remounts for fonts', () => {
    const c = { enter: 'stack:pp', epoch: 'e1', at: 100, shift: 0 };
    const next = enterShift(c, 'stack:pp', 'e2', 250);
    expect(next).toEqual({ enter: 'stack:pp', epoch: 'e2', at: 100, shift: 150 });
  });

  it('keeps the clock when nothing changed', () => {
    const c = { enter: 'stack:pp', epoch: 'e2', at: 100, shift: 150 };
    expect(enterShift(c, 'stack:pp', 'e2', 5000)).toEqual(c);
  });
});
