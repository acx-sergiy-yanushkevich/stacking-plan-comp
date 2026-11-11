// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { scrollToClear, selectionSelector } from './aboveSheet';

describe('scrollToClear', () => {
  // A 768 px window with the sheet's top edge at 400: the room for the selection is 8 to 384.
  const room = { top: 8, bottom: 384 };

  it('does not move a block that already stands whole above the sheet', () => {
    expect(scrollToClear({ top: 100, bottom: 209 }, room)).toBe(0);
    expect(scrollToClear({ top: 8, bottom: 384 - 1 }, room)).toBe(0);
  });

  it('lifts a block the sheet covers until its bottom edge is clear (round 15: Ste 350 at y 409 to 518 under a sheet at 400)', () => {
    const by = scrollToClear({ top: 409, bottom: 518 }, room);
    expect(by).toBe(134);
    expect(518 - by).toBe(384);
    expect(409 - by).toBeGreaterThanOrEqual(room.top);
  });

  it('lifts a block the sheet only cuts (the phone: a suite row whose rent line was under the sheet)', () => {
    expect(scrollToClear({ top: 330, bottom: 392 }, room)).toBe(8);
  });

  it('brings down a block that is above the window', () => {
    expect(scrollToClear({ top: -60, bottom: 40 }, room)).toBe(-68);
  });

  it('shows the top of something taller than the room (a floor card, or any block under a full-height sheet)', () => {
    expect(scrollToClear({ top: 300, bottom: 900 }, room)).toBe(292);
    expect(scrollToClear({ top: 200, bottom: 272 }, { top: 8, bottom: 45 })).toBe(192);
  });
});

describe('selectionSelector', () => {
  it('finds the chosen suite in whichever view is on screen: a stack block, a phone row, a plate slice, a timeline bar', () => {
    expect(selectionSelector('A02', null)).toBe('.sp-stage [data-key="A02"], .sp-stage [data-bar="tl-A02"]');
    expect(selectionSelector('L13-U1', 'F6')).toContain('[data-key="L13-U1"]');
  });

  it('falls back to the open floor, and to nothing when nothing is selected', () => {
    expect(selectionSelector(null, 'F3')).toContain('.sp-stage [data-row="F3"]');
    expect(selectionSelector(null, null)).toBeNull();
  });
});
