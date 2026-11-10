// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { Segment } from '../../domain/derive';
import type { Badge, SegmentText } from '../plan/segmentText';
import { Block } from './Block';

// Without a canvas the text measure is the average-glyph estimate: 0.55 × font size per character
// (13 px name 7.15, 12 px fact 6.6, 11 px 6.05). The widths below are chosen against that.
const seg = (kind: Segment['kind'] = 'leased'): Segment => ({ key: 'k', floorId: 'F7', kind, size: 2400, order: 0, suite: '740', endDate: null, monthsToExpiry: null });
const text = (o: Partial<SegmentText> = {}): SegmentText => ({
  tone: 'rent-2',
  pattern: null,
  name: 'Conner CPA Group Partners',
  sub: 'Ste 740 · 2,400 SF',
  meta: '$32/SF/yr FSG',
  badges: [],
  tooltip: '',
  aria: 'Floor 7, Conner CPA Group Partners',
  sfShort: '2,400',
  lensShort: '$32/SF/yr FSG',
  ...o,
});

function draw(t: SegmentText, w: number, h = 72, s: Segment = seg(), keepSuite = false) {
  const html = renderToString(
    <svg>
      <Block seg={s} text={t} x={0} y={0} w={w} h={h} selected={false} dim={false} focusable enlarged={false} keepSuite={keepSuite} onSelect={() => undefined} onFocus={() => undefined} onKeyDown={() => undefined} />
    </svg>,
  );
  const lines = [...html.matchAll(/<text class="(sp-seg__[a-z-]+)" x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]*)</g)].map((m) => ({ cls: m[1].replace('sp-seg__', ''), y: Number(m[3]), t: m[4].trim().replace(/&#x27;/g, "'").replace(/&amp;/g, '&') }));
  const badge = /<g class="sp-badge sp-badge--(?!deal)[a-z]+" transform="([^"]+)"/.exec(html)?.[1] ?? null;
  const label = /aria-label="([^"]*)"/.exec(html)?.[1].replace(/&#x27;/g, "'").replace(/&amp;/g, '&') ?? '';
  return { html, lines, badge, label };
}
const small = (ls: Array<{ cls: string }>) => ls.filter((l) => l.cls === 'tiny' || l.cls === 'micro' || l.cls === 'small');

describe('Block text, 120 px and wider', () => {
  it('keeps a wrapped name at 13 px with its suite, SF and rate on four lines of a 72 px row', () => {
    const { lines } = draw(text(), 150);
    expect(lines.map((l) => [l.cls, l.t])).toEqual([
      ['name', 'Conner CPA Group'],
      ['name', 'Partners'],
      ['sub', 'Ste 740 · 2,400 SF'],
      ['meta', '$32/SF/yr FSG'],
    ]);
    // The first line stays where a three-line neighbour has it; the pitch closes to 14 px.
    expect(lines.map((l) => l.y)).toEqual([19, 33, 47, 61]);
  });

  it('keeps the suite number and moves the date to the line below', () => {
    const { lines } = draw(text({ name: 'S&P Enterprises', sub: 'Ste 325 · 4,900 SF', sfShort: '4,900', meta: 'Exp Jun 2029 · 2 yr 7 mo', lensShort: "Jun '29", tone: 'leased' }), 150);
    expect(lines.map((l) => l.t)).toEqual(['S&P Enterprises', 'Ste 325 · 4,900 SF', 'Exp Jun 2029']);
    expect(lines.map((l) => l.y)).toEqual([19, 34, 49]);
  });

  it('puts the lease type on the next line when a rate is too long, instead of shrinking it', () => {
    const { lines } = draw(text({ name: 'Available now', sub: 'Ste 860 · 3,200 SF', sfShort: '3,200', meta: 'Asking $131–$133/SF/yr FSG', lensShort: '$131–$133/SF/yr FSG' }), 124, 72, seg('available'));
    expect(lines.map((l) => l.t)).toEqual(['Available now', '3,200 SF', '$131–$133/SF/yr', 'FSG']);
    expect(small(lines)).toEqual([]);
  });

  it('splits the asking rate of the status lens the same way (the rate is the meta line there)', () => {
    const { lines } = draw(text({ name: 'Available now', sub: 'Ste 860 · 3,200 SF', sfShort: '3,200', meta: '$131–$133/SF/yr FSG', lensShort: '', tone: 'available' }), 124, 72, seg('available'));
    expect(lines.map((l) => l.t)).toEqual(['Available now', '3,200 SF', '$131–$133/SF/yr', 'FSG']);
  });

  it('falls back one text tier (name and SF) when the rate cannot fit, and still says the rate aloud', () => {
    const rate = '$1,131.50–$1,133.75/SF/yr FSG';
    const { lines, label } = draw(text({ name: 'Available now', meta: `Asking ${rate}`, lensShort: rate }), 124, 72, seg('available'));
    expect(lines.map((l) => [l.cls, l.t])).toEqual([
      ['name', 'Available now'],
      ['sf', '2,400 SF'],
    ]);
    expect(small(lines)).toEqual([]);
    expect(label).toContain(rate);
  });

  it('never splits a figure that is not a rent', () => {
    const { lines } = draw(text({ name: 'For sale', meta: '$1,027,000 · $395.00/SF', lensShort: '', tone: 'forsale' }), 124, 72, seg('forsale'));
    expect(lines.map((l) => l.t)).toEqual(['For sale', '2,400 SF']);
  });

  it('draws the edge on whole pixels', () => {
    expect(draw(text(), 150).html).toContain('<rect class="sp-seg__rect" x="0.5" y="0.5" width="149" height="71"');
  });
});

describe('Block badges', () => {
  const match: Badge = { kind: 'match', text: '1 inquiry fits' };
  const available = (o: Partial<SegmentText> = {}) => text({ name: 'Available now', sub: 'Ste 850 · 4,200 SF', sfShort: '4,200', meta: '$31–$33/SF/yr FSG', lensShort: '', tone: 'available', badges: [match], ...o });

  it('gives a wide badge its own row on a narrow block, so the name stays on one line', () => {
    const { lines, badge } = draw(available(), 160, 72, seg('available'));
    expect(lines.map((l) => l.t)).toEqual(['Available now', 'Ste 850 · 4,200 SF']);
    expect(badge).toBe('translate(8 48)');
  });

  it('keeps the badge in the corner on a wide block', () => {
    const { lines, badge } = draw(available(), 320, 72, seg('available'));
    expect(lines[0].t).toBe('Available now');
    expect(badge).toBe('translate(217 6)');
  });

  it('leaves an informational badge to the tooltip rather than push the name down to 11 px', () => {
    // Beside the badge the name would need three lines; on a badge row it would lose its SF line.
    const { lines, badge, label } = draw(text({ name: 'BeachBody Workouts Dallas', badges: [{ kind: 'info', text: 'No activity', title: 'No activity logged on this tenant' }] }), 150);
    expect(badge).toBeNull();
    expect(lines.map((l) => [l.cls, l.t])).toEqual([
      ['name', 'BeachBody Workouts'],
      ['name', 'Dallas'],
      ['sub', 'Ste 740 · 2,400 SF'],
      ['meta', '$32/SF/yr FSG'],
    ]);
    expect(label).toContain('No activity logged on this tenant');
  });

  it('never leaves out a risk badge: it is the cue for its state', () => {
    const { lines, badge } = draw(text({ name: 'BeachBody Workouts Dallas', badges: [{ kind: 'risk', text: 'Holdover' }] }), 150);
    expect(badge).toBe('translate(83 6)');
    expect(lines.filter((l) => l.t.split(' ').every((word) => 'BeachBody Workouts Dallas'.includes(word))).map((l) => l.t).join(' ')).toBe('BeachBody Workouts Dallas');
  });
});

describe('Block text, short rows and narrow blocks', () => {
  it('uses the 11 px name only where a wrapped 13 px name has no room (a 48 px print row)', () => {
    const { lines } = draw(text(), 150, 48);
    expect(lines.filter((l) => l.cls === 'tiny').map((l) => l.t).join(' ')).toBe('Conner CPA Group Partners');
    expect(lines.some((l) => l.t.includes('2,400 SF'))).toBe(true);
  });

  it('never shows part of a name', () => {
    for (const w of [56, 64, 90, 124, 150, 200, 260])
      for (const h of [48, 56, 72, 132]) {
        const { lines } = draw(text(), w, h);
        // Lines made of the name's own words (narrow blocks draw facts in the small sizes too).
        const words = new Set('Conner CPA Group Partners'.split(' '));
        const name = lines.filter((l) => l.t.split(' ').every((word) => words.has(word))).map((l) => l.t).join(' ');
        expect(['', 'Conner CPA Group Partners'], `${w}×${h}`).toContain(name);
      }
  });

  it('never drops the SF figure while it draws a name', () => {
    for (const w of [90, 124, 150, 200, 260]) {
      const { lines } = draw(text(), w);
      if (lines.some((l) => l.t.includes('Conner'))) expect(lines.some((l) => l.t.includes('2,400 SF')), `${w}`).toBe(true);
    }
  });
});

describe('Block text in print: a narrow block keeps its suite number', () => {
  const cafe = text({ tone: 'expiring', name: 'Preston Park Café', sub: 'Ste 100 · 2,400 SF', sfShort: '2,400', meta: 'Exp Feb 2027 · 3 mo', lensShort: "Feb '27", aria: 'Floor 1, Preston Park Café' });

  it('on screen a 110 px block in a 48 px row shows name, SF and date, without the suite', () => {
    const { lines } = draw(cafe, 110, 48);
    expect(lines.map((l) => l.t).join(' ')).toContain('Preston Park');
    expect(lines.some((l) => l.t.includes('Ste 100'))).toBe(false);
    expect(lines.some((l) => l.t.includes('2,400 SF'))).toBe(true);
  });

  it('in print the same block keeps "Ste 100 · 2,400 SF", the whole name and the SF figure', () => {
    const { lines, label } = draw(cafe, 110, 48, seg(), true);
    const drawn = lines.map((l) => l.t);
    expect(drawn.some((t) => t.startsWith('Ste 100 · 2,400 SF'))).toBe(true);
    // The name is still whole (on one line or two), never a fragment.
    expect(drawn.join(' ')).toContain('Preston Park Café');
    expect(label).toContain('Preston Park Café');
  });

  it('changes nothing where the suite was already drawn, or where it cannot fit at all', () => {
    const wide = draw(cafe, 200, 48, seg(), true).lines.map((l) => l.t);
    expect(wide).toEqual(draw(cafe, 200, 48).lines.map((l) => l.t));
    const sliver = draw(cafe, 60, 48, seg(), true).lines.map((l) => l.t);
    expect(sliver).toEqual(draw(cafe, 60, 48).lines.map((l) => l.t));
    expect(sliver.join(' ')).toContain('2,400');
  });
});
