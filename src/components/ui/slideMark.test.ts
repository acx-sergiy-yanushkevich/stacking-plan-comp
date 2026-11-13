import { describe, expect, it } from 'vitest';
import { markKeyframes } from './slideMark';

describe('markKeyframes: the mark of a choice slides from the old choice to the new one', () => {
  it('starts on the old choice, as wide as it, and ends at rest on the new one', () => {
    const frames = markKeyframes({ left: 10, width: 50 }, { left: 70, width: 100 });
    expect(frames).toEqual([
      { transform: 'translateX(-60px) scaleX(0.5)', transformOrigin: '0 50%' },
      { transform: 'none', transformOrigin: '0 50%' },
    ]);
  });

  it('rounds the scale to three places', () => {
    expect(markKeyframes({ left: 0, width: 10 }, { left: 30, width: 30 })?.[0].transform).toBe('translateX(-30px) scaleX(0.333)');
  });

  it('does nothing when the mark does not move', () => {
    expect(markKeyframes({ left: 4, width: 20 }, { left: 4, width: 20 })).toBeNull();
  });

  it('does nothing when the new choice has no width (not laid out)', () => {
    expect(markKeyframes({ left: 4, width: 20 }, { left: 40, width: 0 })).toBeNull();
  });
});
