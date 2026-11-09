import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors, type Segment } from './derive';
import { blockLayout, floorWidths, textTier } from './layout';

const seg = (key: string, size: number): Segment => ({
  key,
  floorId: 'F7',
  kind: 'leased',
  size,
  order: 0,
  suite: key,
  endDate: null,
  monthsToExpiry: null,
});

describe('blockLayout', () => {
  it('enlarges a sub-minimum block to 56 px and keeps the row width exact', () => {
    const boxes = blockLayout([seg('700', 12500), seg('720', 7000), seg('740', 2400)], 300);
    const small = boxes.find((b) => b.key === '740')!;
    expect(small.w).toBe(56);
    expect(small.enlarged).toBe(true);
    expect(boxes.filter((b) => b.enlarged)).toHaveLength(1);
    expect(boxes.reduce((s, b) => s + b.w, 0)).toBe(296);
    expect(boxes.every((b) => Number.isInteger(b.w) && Number.isInteger(b.x))).toBe(true);
    // Positions are contiguous with 2 px gaps.
    expect(boxes[1].x).toBe(boxes[0].w + 2);
    expect(boxes[2].x).toBe(boxes[1].x + boxes[1].w + 2);
    expect(boxes[2].x + boxes[2].w).toBe(300);
  });
  it('gives a single segment the full width', () => {
    expect(blockLayout([seg('600', 21400)], 480)).toEqual([{ key: '600', x: 0, w: 480, enlarged: false }]);
  });
  it('falls back to equal widths when every block would be enlarged', () => {
    const boxes = blockLayout([seg('a', 10), seg('b', 10), seg('c', 10)], 100);
    expect(boxes.every((b) => !b.enlarged)).toBe(true);
    expect(boxes.reduce((s, b) => s + b.w, 0)).toBe(96);
  });
  it('keeps proportions when no minimum applies', () => {
    const boxes = blockLayout([seg('a', 1000), seg('b', 3000)], 402);
    expect(boxes.map((b) => b.w)).toEqual([100, 300]);
  });
  it('returns nothing for no segments', () => {
    expect(blockLayout([], 300)).toEqual([]);
  });
});

describe('textTier', () => {
  it('maps widths to tiers', () => {
    expect(textTier(200)).toBe(0);
    expect(textTier(199)).toBe(1);
    expect(textTier(120)).toBe(1);
    expect(textTier(119)).toBe(2);
    expect(textTier(64)).toBe(2);
    expect(textTier(63)).toBe(3);
  });
});

describe('floorWidths', () => {
  const floors = deriveFloors(property, TODAY, TODAY);
  const widths = floorWidths(floors, 600);

  it('gives the widest floor maxPx', () => {
    expect(Math.max(...widths.values())).toBe(600);
    expect(widths.get('F2')).toBe(600);
  });
  it('never drops below 60 % of maxPx', () => {
    for (const w of widths.values()) expect(w).toBeGreaterThanOrEqual(360);
  });
  it('makes F1 (14,600 leasable) narrower than F2 (21,400)', () => {
    expect(widths.get('F1')!).toBeLessThan(widths.get('F2')!);
    expect(widths.get('F12')!).toBeGreaterThanOrEqual(360);
  });
  it('honours a custom floor share', () => {
    const w = floorWidths(floors, 600, 0.9);
    for (const v of w.values()) expect(v).toBeGreaterThanOrEqual(540);
  });
});
