// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SegmentText } from '../plan/segmentText';
import { keyText, linesFor, rentOf, sliceName } from './FloorPlate';

// Without a canvas the text measure is the average-glyph estimate: 0.55 × font size per character
// (13 px name 7.15, 12 px fact 6.6, 11 px 6.05). The widths below are chosen against that.
const text = (o: Partial<SegmentText> = {}): SegmentText => ({
  tone: 'available',
  pattern: null,
  name: 'Available now',
  sub: 'Ste 860 · 3,200 SF',
  meta: '$31–$33/SF/yr FSG',
  badges: [],
  tooltip: '',
  aria: 'Floor 8, Available now',
  sfShort: '3,200',
  lensShort: '',
  ...o,
});
const drawn = (ls: ReturnType<typeof linesFor>) => ls.map((l) => l.t);
const px = (ls: ReturnType<typeof linesFor>) => ls.map((l) => Number(/(\d+)px/.exec(l.font)![1]));

describe('floor plate label lines', () => {
  it('never breaks a rate: one that is too wide at 12 px takes its line whole at 11 px', () => {
    // 17 characters: 112 px at 12 px, 103 px at 11 px.
    const ls = linesFor(text(), 1, 104, 200, 'name');
    expect(drawn(ls)).toEqual(['Available now', 'Ste 860', '3,200 SF', '$31–$33/SF/yr FSG']);
    expect(px(ls)).toEqual([13, 12, 12, 11]);
  });

  it('leaves a rate off a slice that cannot hold it whole (the key under the plate writes it), and never a lone lease type', () => {
    const ls = linesFor(text(), 1, 100, 200, 'name');
    expect(drawn(ls)).toEqual(['Available now', 'Ste 860', '3,200 SF']);
    for (let fw = 40; fw <= 240; fw += 4)
      for (const tier of [0, 1, 2] as const)
        for (const l of linesFor(text({ lensShort: tier === 2 ? '$31–$33/SF/yr FSG' : '' }), tier, fw, 200, 'name')) {
          expect(l.t, `${fw} px`).not.toMatch(/^(FSG|MG|NNN)$/);
          if (l.t.includes('/SF/')) expect(l.t, `${fw} px`).toBe('$31–$33/SF/yr FSG');
        }
  });

  it('names the rent a slice has to show, without "Asking"; a date or a price is not one', () => {
    expect(rentOf(text())).toBe('$31–$33/SF/yr FSG');
    expect(rentOf(text({ meta: 'Asking $31–$33/SF/yr FSG' }))).toBe('$31–$33/SF/yr FSG');
    expect(rentOf(text({ meta: 'Exp Jun 2029 · 2 yr 7 mo' }))).toBe('');
    expect(rentOf(text({ meta: '$1,027,000 · $395.00/SF' }))).toBe('');
    expect(rentOf(text({ meta: 'Rent confidential' }))).toBe('');
  });

  it('drops "Asking" before it shrinks or leaves out a rate', () => {
    expect(drawn(linesFor(text({ meta: 'Asking $31–$33/SF/yr FSG' }), 1, 122, 200, 'name'))).toEqual(['Available now', 'Ste 860 · 3,200 SF', '$31–$33/SF/yr FSG']);
  });

  it('keeps the rate on a narrow slice too, whole, when it fits at 11 px', () => {
    const ls = linesFor(text({ lensShort: '$31–$33/SF/yr FSG' }), 2, 104, 200, 'name');
    expect(drawn(ls)).toEqual(['Available now', 'Ste 860', '3,200 SF', '$31–$33/SF/yr FSG']);
  });

  it('never leaves half a rate on a short slice', () => {
    const ls = linesFor(text(), 1, 100, 70, 'name');
    expect(drawn(ls)).toEqual(['Available now', '3,200 SF']);
  });

  it('keeps a figure that is not a rent on one line, or shortens it by whole parts', () => {
    const ls = linesFor(text({ name: 'For sale', sub: 'Ste 130 · 2,600 SF', sfShort: '2,600', meta: '$1,027,000 · $395.00/SF', tone: 'forsale' }), 1, 100, 200, 'name');
    expect(drawn(ls)).toEqual(['For sale', 'Ste 130', '2,600 SF', '$1,027,000']);
  });

  it('wraps a name onto two lines on a narrow slice rather than dropping it', () => {
    const t = text({ name: 'S&P Enterprises', sub: 'Ste 325 · 4,900 SF', sfShort: '4,900', meta: 'Exp Jun 2029 · 2 yr 7 mo', lensShort: "Jun '29", tone: 'leased' });
    // 88 px does not hold "S&P Enterprises" on one line at 13 px (107 px), but it holds "S&P" / "Enterprises".
    const ls = linesFor(t, 2, 88, 180, 'name');
    expect(drawn(ls)).toEqual(['S&P', 'Enterprises', 'Ste 325', '4,900 SF', "Jun '29"]);
    expect(px(ls).slice(0, 2)).toEqual([13, 13]);
    const cafe = text({ name: 'Preston Park Café', sub: 'Ste 100 · 2,400 SF', sfShort: '2,400', meta: 'Exp Feb 2027 · 3 mo', lensShort: "Feb '27", tone: 'expiring' });
    expect(drawn(linesFor(cafe, 2, 90, 180, 'name'))).toEqual(['Preston Park', 'Café', 'Ste 100', '2,400 SF', "Feb '27"]);
  });

  it('draws no part of a name that cannot be held on two lines: the suite, SF and lens fact stay (the key under the plate carries the name)', () => {
    const t = text({ name: 'S&P Enterprises', sub: 'Ste 325 · 4,900 SF', sfShort: '4,900', meta: 'Exp Jun 2029 · 2 yr 7 mo', lensShort: "Jun '29", tone: 'leased' });
    // 60 px holds "Enterprises" at neither 13 px (79 px) nor 11 px (67 px): a word is never split.
    for (const mode of ['name', 'tiny', 'none'] as const) expect(drawn(linesFor(t, 2, 60, 180, mode)), mode).toEqual(['Ste 325', '4,900 SF', "Jun '29"]);
    // 70 px holds it at 11 px: still the whole name.
    expect(drawn(linesFor(t, 2, 70, 180, 'tiny'))).toEqual(['S&P', 'Enterprises', 'Ste 325', '4,900 SF', "Jun '29"]);
    expect(keyText(t)).toBe('S&P Enterprises · Ste 325 · 4,900 SF');
    // A rent that found no room on its slice is written in the key, whole.
    expect(keyText(text(), '$31–$33/SF/yr FSG')).toBe('Available now · Ste 860 · 3,200 SF · $31–$33/SF/yr FSG');
  });

  it('never breaks a state ("Available now") inside a slice: one line at 13 px, at 11 px, or not drawn (the key carries it)', () => {
    // "Available now" is 93 px at 13 px and 79 px at 11 px.
    expect(drawn(linesFor(text(), 1, 100, 200, 'name', 1)).slice(0, 1)).toEqual(['Available now']);
    expect(px(linesFor(text(), 1, 100, 200, 'name', 1)).slice(0, 1)).toEqual([13]);
    // Too narrow at 13 px: not broken at that size but left to the 11 px pass, where it is one line;
    // with no room at either, the slice says its state in a word under the SF.
    expect(drawn(linesFor(text(), 1, 88, 200, 'name', 1))).toEqual(['Ste 860', '3,200 SF', 'Available']);
    expect(drawn(linesFor(text(), 1, 88, 200, 'tiny', 1))[0]).toBe('Available now');
    for (let fw = 40; fw <= 240; fw += 2)
      for (const mode of ['name', 'tiny', 'none'] as const) {
        const ls = drawn(linesFor(text(), 1, fw, 200, mode, 1));
        expect(ls, `${fw} px ${mode}`).not.toContain('now');
      }
    // A tenant's name still wraps once rather than being dropped.
    const t = text({ name: 'S&P Enterprises', sub: 'Ste 325 · 4,900 SF', sfShort: '4,900', tone: 'leased' });
    expect(drawn(linesFor(t, 2, 88, 180, 'name')).slice(0, 2)).toEqual(['S&P', 'Enterprises']);
  });

  it('builds every key entry from the same parts: name, suite and SF, then the rent the slice had no room for', () => {
    const rent = '$31–$33/SF/yr FSG';
    expect(keyText(text({ sub: 'Ste 850 · 4,200 SF', sfShort: '4,200' }), rent)).toBe('Available now · Ste 850 · 4,200 SF · $31–$33/SF/yr FSG');
    expect(keyText(text(), rent)).toBe('Available now · Ste 860 · 3,200 SF · $31–$33/SF/yr FSG');
    expect(keyText(text())).toBe('Available now · Ste 860 · 3,200 SF');
  });

  it('names a slice by its facts alone: no key number, the same whatever is drawn or selected', () => {
    expect(sliceName(text({ aria: 'Floor 8, Available now, Ste 860 · 3,200 SF, $31–$33/SF/yr FSG' }))).toBe('Floor 8, Available now, Ste 860, 3,200 SF, $31–$33/SF/yr FSG');
    const t = text({ name: 'Meridian Health Partners', sub: 'Ste 800 · 14,000 SF', meta: 'Exp Dec 2033 · 7 yr 1 mo', aria: 'Floor 8, Meridian Health Partners', tone: 'leased', badges: [{ kind: 'deal', text: '2' }] });
    expect(sliceName(t)).toBe('Floor 8, Meridian Health Partners, Ste 800, 14,000 SF, Exp Dec 2033 · 7 yr 1 mo, 2 live deals');
  });

  it('reads the short fact a narrow slice draws, so the drawn words are in its name (round 19)', () => {
    const t = text({ name: 'Conner CPA Group', sub: 'Ste 740 · 2,400 SF', meta: 'Expires Apr 30, 2028 · 1 yr 5 mo', lensShort: "Apr '28", aria: 'Floor 7, Conner CPA Group', tone: 'leased' });
    expect(sliceName(t)).toContain("Apr '28");
    // Not twice when the full fact already holds it.
    const same = text({ meta: 'Exp Dec 2033', lensShort: 'Dec 2033' });
    expect(sliceName(same).match(/Dec 2033/g)).toHaveLength(1);
  });

  it('breaks "Tenant · sublease" at its separator, never leaving the dot at the end or start of a line', () => {
    const t = text({ name: 'Infinity Info Systems · sublease', sub: 'Ste 720 · 7,000 SF', sfShort: '7,000', meta: 'Sublease thru Sep 2030', tone: 'sublease' });
    expect(drawn(linesFor(t, 1, 160, 200, 'name')).slice(0, 2)).toEqual(['Infinity Info Systems', 'sublease']);
    expect(drawn(linesFor(t, 0, 260, 200, 'name'))[0]).toBe('Infinity Info Systems · sublease');
  });

  it('wraps a name once at most on a wide slice', () => {
    const two = text({ name: 'North American Asset Holdings', sub: 'Ste 500 · 6,500 SF', sfShort: '6,500', meta: 'Exp Oct 2027 · 11 mo', tone: 'expiring' });
    expect(drawn(linesFor(two, 1, 130, 200, 'name'))).toEqual(['North American', 'Asset Holdings', 'Ste 500 · 6,500 SF', 'Exp Oct 2027']);
    const three = { ...two, name: 'North American Asset Holdings Group International' };
    for (const mode of ['name', 'tiny'] as const) expect(drawn(linesFor(three, 1, 130, 200, mode)), mode).toEqual(['Ste 500 · 6,500 SF', 'Exp Oct 2027']);
  });

  it('never drops the SF figure where it fits', () => {
    for (const tier of [0, 1, 2] as const)
      for (const fw of [56, 60, 88, 100, 130, 220])
        for (const bh of [40, 70, 120, 300]) expect(drawn(linesFor(text(), tier, fw, bh, 'name')).join(' '), `${tier} ${fw}×${bh}`).toContain('3,200 SF');
  });
});
