import { describe, expect, it } from 'vitest';
import { playEnd, playNext, playStart } from './playback';

const TODAY = '2026-11-09';

describe('play through time', () => {
  it('steps a quarter at a time', () => {
    expect(playNext(TODAY, TODAY)).toBe('2027-02-09');
    expect(playNext('2027-02-09', TODAY)).toBe('2027-05-09');
  });

  it('ends five years out, and never steps past the end', () => {
    expect(playEnd(TODAY)).toBe('2031-11-09');
    expect(playNext('2031-10-01', TODAY)).toBe('2031-11-09');
    expect(playNext('2031-11-09', TODAY)).toBeNull();
    expect(playNext('2040-01-01', TODAY)).toBeNull();
  });

  it('reaches the end from today in twenty steps', () => {
    let d: string | null = TODAY;
    let steps = 0;
    for (let next = playNext(d, TODAY); next; next = playNext(d, TODAY)) {
      d = next;
      steps++;
    }
    expect(d).toBe(playEnd(TODAY));
    expect(steps).toBe(20);
  });

  it('starts from the date the plan is at', () => {
    expect(playStart('2027-06-01', TODAY)).toBe('2027-06-01');
    expect(playStart(TODAY, TODAY)).toBe(TODAY);
  });

  it('starts over from today when the plan is at the end, past it, or in the past', () => {
    expect(playStart('2031-11-09', TODAY)).toBe(TODAY);
    expect(playStart('2035-01-01', TODAY)).toBe(TODAY);
    expect(playStart('2025-01-01', TODAY)).toBe(TODAY);
  });
});
