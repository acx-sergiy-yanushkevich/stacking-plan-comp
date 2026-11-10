// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fitParts, fits, fitWords, measure, wrapWords, wrapWordsVar } from './textFit';

const FONT = "400 12px Inter, 'Salesforce Sans', system-ui, sans-serif";

describe('text fitting without a canvas', () => {
  it('estimates 0.55 × font size per character, with no tabular correction to read from a layout', () => {
    expect(measure('Ste 1100', FONT)).toBeCloseTo(8 * 12 * 0.55, 6);
    // Same estimate for narrow and wide digits: the correction needs a DOM and is skipped here.
    expect(measure('1111', FONT)).toBe(measure('0000', FONT));
    expect(measure('abc', "600 13px Inter, sans-serif")).toBeCloseTo(3 * 13 * 0.55, 6);
  });

  it('wraps on whole words and gives up rather than cut one', () => {
    expect(wrapWords('North American Asset Holdings', 100, FONT, 2)).toEqual(['North American', 'Asset Holdings']);
    expect(wrapWords('Supercalifragilistic Group', 60, FONT, 2)).toEqual([]);
    // Out of lines: the caller compares the join with the original to see the name did not fit.
    expect(wrapWords('North American Asset Holdings', 60, FONT, 2).join(' ')).not.toBe('North American Asset Holdings');
  });

  it('wraps with a width per line', () => {
    expect(wrapWordsVar('Infinity Info Systems', (i) => (i === 0 ? 60 : 120), FONT, 2)).toEqual(['Infinity', 'Info Systems']);
  });

  it('keeps whole " · " parts and whole words only', () => {
    expect(fitParts('Exp Jun 2029 · 2 yr 7 mo', 100, FONT)).toBe('Exp Jun 2029');
    expect(fitParts('$31–$33/SF/yr FSG', 60, FONT)).toBe('');
    expect(fitWords('Exp Jun 2029', 50, FONT)).toBe('Exp Jun');
    expect(fits('FSG', 20, FONT)).toBe(true);
    expect(fits('$31–$33/SF/yr FSG', 100, FONT)).toBe(false);
  });
});
