// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AIR_ABOVE, AIR_BELOW, roomToKeep, sameLayout, scrollToClear, selectionSelector } from './aboveSheet';

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

  it('scrolls by whole pixels, rounded the way that keeps the block clear (round 17: 0.1 px of a row was left under the sheet)', () => {
    // The phone's half sheet starts at 438.9, a fraction of a pixel: the room ends at 422.9.
    const half = { top: AIR_ABOVE, bottom: 438.9 - AIR_BELOW };
    expect(scrollToClear({ top: 372.3, bottom: 423 }, half)).toBe(1);
    expect(scrollToClear({ top: 701.2, bottom: 752.2 }, half)).toBe(330);
    expect(752.2 - 330).toBeLessThanOrEqual(half.bottom);
    // Above the window: brought down far enough, not a fraction short.
    expect(scrollToClear({ top: 7.6, bottom: 60 }, half)).toBe(-1);
    // An expanded sheet leaves the row its own height and a pixel: a row at a fraction still fits whole.
    const tight = { top: AIR_ABOVE, bottom: AIR_ABOVE + 77 };
    const by = scrollToClear({ top: 9.9, bottom: 85.9 }, tight);
    expect(9.9 - by).toBeGreaterThanOrEqual(tight.top);
    expect(85.9 - by).toBeLessThanOrEqual(tight.bottom);
  });

  it('shows the top of something taller than the room (a floor card, or any block under a full-height sheet)', () => {
    expect(scrollToClear({ top: 300, bottom: 900 }, room)).toBe(292);
    expect(scrollToClear({ top: 200, bottom: 272 }, { top: 8, bottom: 45 })).toBe(192);
  });
});

describe('roomToKeep', () => {
  it('is the block, whole, with the air above it and between it and the sheet', () => {
    // And one pixel more: the page scrolls by whole pixels, and a row that stands at a fraction of one
    // (round 17: 8.9 to 84.9 under a sheet at 100) needs it to have a scroll position that clears it.
    expect(roomToKeep(109)).toBe(AIR_ABOVE + 109 + 1 + AIR_BELOW);
    // A fraction of a pixel is rounded up: the block is never a hair under the sheet.
    expect(roomToKeep(66.9)).toBe(AIR_ABOVE + 67 + 1 + AIR_BELOW);
  });

  it('is room in which the scroll helper can place the complete block (round 16: only its top edge was placed)', () => {
    // A sheet whose top edge is exactly at the kept room: the block fits it to the pixel.
    const edge = roomToKeep(109);
    const by = scrollToClear({ top: 409, bottom: 518 }, { top: AIR_ABOVE, bottom: edge - AIR_BELOW });
    expect(409 - by).toBe(AIR_ABOVE + 1);
    expect(518 - by).toBe(edge - AIR_BELOW);
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

describe('sameLayout', () => {
  // Round 17, desktop to phone: L17-U3 is a 94 px block 507 px down the page, then a 51 px row 701 px down it under a sheet at 439.
  const desktop = { at: 507, height: 94, edge: 800, viewport: 800 };
  const phone = { at: 972, height: 51, edge: 439, viewport: 844 };

  it('is the same however far the page has scrolled: the selection is measured from the top of the page', () => {
    expect(sameLayout(phone, { ...phone })).toBe(true);
    expect(sameLayout(phone, { ...phone, at: phone.at + 0.3 })).toBe(true);
  });

  it('has moved when the selection moves in the page, changes height, or the sheet or the window does', () => {
    expect(sameLayout(desktop, phone)).toBe(false);
    // The header above the plan gets 46 px shorter a render after the window narrows.
    expect(sameLayout(phone, { ...phone, at: phone.at - 46 })).toBe(false);
    expect(sameLayout(phone, { ...phone, height: 38 })).toBe(false);
    expect(sameLayout(phone, { ...phone, edge: 68 })).toBe(false);
    expect(sameLayout(phone, { ...phone, viewport: 667 })).toBe(false);
  });

  it('a layout that has moved is placed again with the room of the row as drawn now (round 17: the stack block\'s 94 px was kept for a 51 px row)', () => {
    const edge = phone.edge;
    const by = scrollToClear({ top: 701, bottom: 701 + phone.height }, { top: AIR_ABOVE, bottom: edge - AIR_BELOW });
    expect(701 - by).toBeGreaterThanOrEqual(AIR_ABOVE);
    expect(701 + phone.height - by).toBeLessThanOrEqual(edge - AIR_BELOW);
    expect(roomToKeep(phone.height)).toBe(AIR_ABOVE + 51 + 1 + AIR_BELOW);
  });
});
