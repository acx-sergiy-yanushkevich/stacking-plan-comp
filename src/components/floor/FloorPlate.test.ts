// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SegmentText } from '../plan/segmentText';
import { keyEntry, keyText, linesFor, rentOf } from './FloorPlate';

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

  it('writes in the key only what the slice does not show: the whole entry, or the suite and the rent', () => {
    const rent = '$31–$33/SF/yr FSG';
    // Nothing but the marker on the slice: everything is in the key.
    expect(keyEntry(text(), rent, [])).toBe('Available now · Ste 860 · 3,200 SF · $31–$33/SF/yr FSG');
    // Name and SF are on the slice (the name wrapped over two lines): the key adds the rent, under the suite number.
    expect(keyEntry(text(), rent, ['Available', 'now', 'Ste 860', '3,200 SF'])).toBe('Ste 860 · $31–$33/SF/yr FSG');
    // The SF is not on the slice: the whole entry again, so the figure is on screen.
    expect(keyEntry(text(), rent, ['Available now', 'Ste 860'])).toBe('Available now · Ste 860 · 3,200 SF · $31–$33/SF/yr FSG');
    // No rent to add: the name's entry, as before.
    expect(keyEntry(text(), '', [])).toBe('Available now · Ste 860 · 3,200 SF');
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
