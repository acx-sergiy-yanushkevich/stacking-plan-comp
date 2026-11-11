// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { boxAt, clearFrom, cubicBezier, type Box, type Glide } from './glide';

const box = (left: number, top: number, w: number, h: number): Box => ({ left, top, right: left + w, bottom: top + h });
const ease = cubicBezier(0.22, 0.8, 0.2, 1);

describe('cubicBezier', () => {
  it('starts at 0, ends at 1 and rises all the way', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    let last = 0;
    for (let i = 1; i <= 100; i += 1) {
      const v = ease(i / 100);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it('is the identity for a linear curve, and fast at the start for the dock curve', () => {
    const linear = cubicBezier(0, 0, 1, 1);
    for (const t of [0.1, 0.25, 0.5, 0.9]) expect(linear(t)).toBeCloseTo(t, 4);
    expect(ease(0.2)).toBeGreaterThan(0.5);
  });
});

describe('boxAt', () => {
  // The model stood at x 300, ground line 600, drawn twice as large; it comes to rest in a 160 × 250 box at x 80.
  const glide: Glide = { to: box(80, 300, 160, 250), dx: 220, dy: 50, scale: 2 };

  it('is the old place and size at the start and the new box at rest', () => {
    expect(boxAt(glide, 0)).toEqual({ left: 300, bottom: 600, right: 300 + 160 * 2, top: 600 - 250 * 2 });
    expect(boxAt(glide, 1)).toEqual(glide.to);
  });

  it('keeps the lower left corner on a straight path between the two', () => {
    const mid = boxAt(glide, 0.5);
    expect(mid.left).toBe(190);
    expect(mid.bottom).toBe(575);
    expect(mid.right - mid.left).toBe(160 * 1.5);
  });
});

describe('clearFrom', () => {
  it('is 0 when the model never touches the place', () => {
    expect(clearFrom({ to: box(80, 300, 160, 250), dx: 220, dy: 50, scale: 2 }, box(900, 0, 200, 800), ease)).toBe(0);
  });

  it('waits for a model that sets out from over the place', () => {
    // The model stands over the picker's place (x 33–73) and glides right to x 81: the picker waits for it.
    const glide: Glide = { to: box(81, 300, 160, 250), dx: -61, dy: 0, scale: 1.6 };
    const picker = box(33, 250, 40, 300);
    const t = clearFrom(glide, picker, ease);
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(1);
    // From that moment on the box is clear of the place, and just before it was not.
    for (let i = 0; i <= 50; i += 1) {
      const at = t + ((1 - t) * i) / 50;
      expect(boxAt(glide, ease(at)).left, `at ${at}`).toBeGreaterThanOrEqual(picker.right);
    }
    expect(boxAt(glide, ease(Math.max(0, t - 2 / 120))).left).toBeLessThan(picker.right + 2);
  });

  it('is 1 when the model rests on the place', () => {
    expect(clearFrom({ to: box(80, 300, 160, 250), dx: 220, dy: 50, scale: 2 }, box(100, 320, 50, 50), ease)).toBe(1);
  });
});
