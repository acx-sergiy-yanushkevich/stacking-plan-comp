import { describe, expect, it } from 'vitest';
import { EXPORT_PLAN_WIDTH, imageSize, localUrls, referencedIds } from './exportPng';
import { PATTERN_IDS } from '../components/plan/Patterns';

/**
 * The parts of the PNG export that need no browser. The export itself (a download, decoded, with the
 * sublease dots and the committed hatching in it, on a desktop and on a phone) is checked in Chrome by
 * `npm run exportcheck`.
 */
describe('PNG export: definitions referenced from outside the SVG', () => {
  it('finds the pattern ids a serialised plan points at, however the browser wrote the reference', () => {
    const markup = [
      `<rect fill="url(#${PATTERN_IDS.dots})"/>`,
      `<rect style="fill:url(&quot;#${PATTERN_IDS.hatch}&quot;);stroke:rgb(1, 2, 3)"/>`,
      `<rect style="fill: url('http://localhost:4180/?view=stack&amp;lens=rent#${PATTERN_IDS.asking}')"/>`,
      '<use href="#sp-icon"/><use xlink:href="#sp-other"/>',
      '<rect fill="#00aff0" stroke="rgb(0, 175, 240)"/>',
    ].join('');
    expect(referencedIds(markup).sort()).toEqual([PATTERN_IDS.asking, PATTERN_IDS.dots, PATTERN_IDS.hatch, 'sp-icon', 'sp-other'].sort());
  });

  it('finds nothing in markup that only has colours', () => {
    expect(referencedIds('<rect fill="#1e2d3c" style="fill:rgb(30, 45, 60);color:#fff"/>')).toEqual([]);
  });

  it('rewrites a reference to the local fragment: a page URL means nothing inside an image file', () => {
    expect(localUrls('url("#sp-dots")')).toBe('url(#sp-dots)');
    expect(localUrls("url('#sp-dots')")).toBe('url(#sp-dots)');
    expect(localUrls('url(#sp-dots)')).toBe('url(#sp-dots)');
    expect(localUrls('url("http://localhost:4180/?view=stack&safe=1#sp-hatch")')).toBe('url(#sp-hatch)');
    expect(localUrls('url("https://example.test/plan#sp-asking") rgb(1, 2, 3)')).toBe('url(#sp-asking) rgb(1, 2, 3)');
    // Colours and plain values are not touched.
    for (const v of ['rgb(30, 45, 60)', '#00aff0', 'none', 'currentcolor', '4px 2px']) expect(localUrls(v), v).toBe(v);
  });
});

describe('PNG export: the size of the image', () => {
  it('is the rendered box, rounded up to whole pixels', () => {
    expect(imageSize({ width: 1010.4, height: 932.2 })).toEqual({ w: 1011, h: 933 });
    expect(imageSize({ width: 1010.4, height: 932.2 }, { width: '0', height: '0', viewBox: '0 0 5 5' })).toEqual({ w: 1011, h: 933 });
  });

  it('falls back to the SVG\'s own width and height, then its viewBox, when it has no box', () => {
    const none = { width: 0, height: 0 };
    expect(imageSize(none, { width: '1184', height: '930' })).toEqual({ w: 1184, h: 930 });
    expect(imageSize(none, { width: '1184px', height: '930.5px' })).toEqual({ w: 1184, h: 931 });
    expect(imageSize(none, { width: '100%', height: 'auto', viewBox: '0 0 1184 930' })).toEqual({ w: 1184, h: 930 });
    expect(imageSize(none, { viewBox: '0,0,640,480' })).toEqual({ w: 640, h: 480 });
  });

  it('is null for an SVG that was never laid out: the hidden print plan on a phone (0 × 0, drawn for no width)', () => {
    const none = { width: 0, height: 0 };
    expect(imageSize(none)).toBeNull();
    expect(imageSize(none, { width: '0', height: '668', viewBox: '0 0 0 668' })).toBeNull();
    expect(imageSize(none, { width: '100%', height: 'auto' })).toBeNull();
    expect(imageSize({ width: Number.NaN, height: 10 }, { viewBox: 'none' })).toBeNull();
  });

  it('the plan drawn for an export when none is on screen has a fixed width, whatever the screen', () => {
    expect(EXPORT_PLAN_WIDTH).toBe(1200);
  });
});
