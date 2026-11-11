// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SHEET_HALF, SHEET_MOST, canExpandSheet, expandedSheetHeight } from './sheetHeight';
import { AIR_ABOVE, AIR_BELOW, roomToKeep, scrollToClear } from '../stack/aboveSheet';

/** The windows the sheet is used at: a phone, a tablet upright, and a tablet on its side with and without browser chrome. */
const WINDOWS = [844, 1180, 768, 844];

describe('expandedSheetHeight', () => {
  it('is the height of the content when that fits: no empty band under it (round 16: 170 px were empty at 1024×768)', () => {
    // 1024×768, a suite 109 px tall selected, a panel that needs 521 px.
    expect(expandedSheetHeight({ viewport: 768, content: 521, keepClear: roomToKeep(109) })).toBe(521);
    expect(expandedSheetHeight({ viewport: 768, content: 520.4, keepClear: null })).toBe(521);
  });

  it('never takes more than 92% of the window, however long the content', () => {
    for (const viewport of WINDOWS) expect(expandedSheetHeight({ viewport, content: 5000, keepClear: null })).toBe(Math.floor(SHEET_MOST * viewport));
  });

  it('stops short of the selection: the whole block and its air fit above the sheet (round 16: 56 of 109 px were covered)', () => {
    for (const viewport of WINDOWS) {
      for (const block of [26, 38, 51, 67, 94, 109, 149, 191]) {
        const height = expandedSheetHeight({ viewport, content: 5000, keepClear: roomToKeep(block) });
        const edge = viewport - height;
        // The block stands at the top of the window with its air, and ends above the sheet's top edge with its air.
        expect(edge - AIR_BELOW - AIR_ABOVE).toBeGreaterThanOrEqual(block);
        // Wherever the block is, the scroll that clears it leaves it whole inside the room.
        const by = scrollToClear({ top: 300, bottom: 300 + block }, { top: AIR_ABOVE, bottom: edge - AIR_BELOW });
        expect(300 - by).toBeGreaterThanOrEqual(AIR_ABOVE);
        expect(300 + block - by).toBeLessThanOrEqual(edge - AIR_BELOW);
      }
    }
  });

  it('is never shorter than the half snap: short content, or a selection too tall for more', () => {
    expect(expandedSheetHeight({ viewport: 1180, content: 300, keepClear: null })).toBe(SHEET_HALF * 1180);
    expect(expandedSheetHeight({ viewport: 844, content: 5000, keepClear: roomToKeep(600) })).toBe(SHEET_HALF * 844);
  });

  it('takes the most it may before the content has been measured', () => {
    expect(expandedSheetHeight({ viewport: 768, content: null, keepClear: null })).toBe(Math.floor(SHEET_MOST * 768));
    expect(expandedSheetHeight({ viewport: 768, content: null, keepClear: roomToKeep(109) })).toBe(768 - roomToKeep(109));
  });
});

describe('canExpandSheet', () => {
  it('offers the control when expanding shows more', () => {
    expect(canExpandSheet({ viewport: 768, content: 521, keepClear: roomToKeep(109) })).toBe(true);
    expect(canExpandSheet({ viewport: 844, content: 900, keepClear: null })).toBe(true);
  });

  it('does not when the half snap already shows everything (a short panel on a tall tablet)', () => {
    expect(canExpandSheet({ viewport: 1180, content: 520, keepClear: roomToKeep(94) })).toBe(false);
    expect(canExpandSheet({ viewport: 1180, content: 0.48 * 1180 + 10, keepClear: null })).toBe(false);
  });

  it('does not when the selection leaves no room to grow into (a phone floor card as tall as the room above the sheet)', () => {
    expect(canExpandSheet({ viewport: 844, content: 5000, keepClear: roomToKeep(420) })).toBe(false);
  });
});
