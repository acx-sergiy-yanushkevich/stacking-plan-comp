// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { FloorLabels, type FloorLabelRow } from './FloorLabels';

const row = (n: number, over: Partial<FloorLabelRow> = {}): FloorLabelRow => ({
  id: `F${n}`,
  share: 1,
  parts: { number: String(n), leased: '100.0% leased', space: '', fact: '', largest: false },
  name: `Floor ${n}, 100.0% leased`,
  title: `Floor ${n} · 20,800 RSF leasable · 100.0% leased · 0 SF available`,
  ...over,
});
const rows = [
  row(3, { share: 0.5, parts: { number: '3', leased: '50.0% leased', space: '9,300 SF available', fact: '', largest: true }, name: 'Floor 3, 50.0% leased, 9,300 SF available, largest block' }),
  row(2),
  row(1, { share: 0.654, parts: { number: '1', leased: '65.4% leased', space: '7,400 SF available', fact: 'holdover', largest: false }, name: 'Floor 1, 65.4% leased, 7,400 SF available, holdover' }),
];
const render = (hotId: string | null = null) => renderToString(<FloorLabels rows={rows} hotId={hotId} onPick={() => {}} onPreview={() => {}} />);
const buttons = (html: string) => [...html.matchAll(/(<button[^>]*>)(.*?)<\/button>/g)].map((m) => ({ tag: m[1], text: m[2].replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '') }));

describe('FloorLabels', () => {
  it('is one list of floors, a button per floor, top floor first', () => {
    const html = render();
    expect(html).toMatch(/^<nav class="sp-flabels" aria-label="Floors">/);
    expect(html.match(/<ol /g)?.length).toBe(1);
    expect(html).toContain('<ol class="sp-floorlist sp-flabels__list">');
    expect(html.match(/<li>/g)?.length).toBe(3);
    expect(buttons(html).map((b) => /data-floor="([^"]+)"/.exec(b.tag)?.[1])).toEqual(['F3', 'F2', 'F1']);
  });

  it('prints the floor number, the leased share and the fact, whole, and nothing after a full floor', () => {
    expect(buttons(render()).map((b) => b.text)).toEqual(['3 · 50.0% leased · 9,300 SF available Largest block', '2 · 100.0% leased', '1 · 65.4% leased · 7,400 SF available · holdover']);
  });

  it('names each button with the floor in full and gives it the floor\'s sentence as a tooltip', () => {
    const b = buttons(render());
    expect(b[0].tag).toContain('aria-label="Floor 3, 50.0% leased, 9,300 SF available, largest block"');
    expect(b[1].tag).toContain('aria-label="Floor 2, 100.0% leased"');
    expect(b[1].tag).toContain('title="Floor 2 · 20,800 RSF leasable · 100.0% leased · 0 SF available"');
  });

  it('is one tab stop: the top floor until another has been focused', () => {
    const b = buttons(render());
    expect(b.map((x) => /tabindex="(-?\d)"/.exec(x.tag)?.[1])).toEqual(['0', '-1', '-1']);
  });

  it('tags the floor of the largest block in words, and only that floor', () => {
    const html = render();
    expect(html.match(/class="sp-flabel__tag"/g)?.length).toBe(1);
    expect(html).toContain('<span class="sp-flabel__tag">Largest block</span>');
  });

  it('draws the leased share as a bar hidden from assistive technology: the figure beside it is the cue', () => {
    const html = render();
    expect(html.match(/<span class="sp-flabel__bar" aria-hidden="true"><span style="width:(\d+)%"><\/span><\/span>/g)?.length).toBe(3);
    expect([...html.matchAll(/sp-flabel__bar" aria-hidden="true"><span style="width:(\d+)%"/g)].map((m) => m[1])).toEqual(['50', '100', '65']);
  });

  it('draws its leaders as decoration: hidden from assistive technology, before the list', () => {
    const html = render();
    expect(html).toMatch(/^<nav class="sp-flabels" aria-label="Floors"><svg class="sp-fleaders" aria-hidden="true" focusable="false"><\/svg><ol /);
  });

  it('prints every row as the shared floor label: a button 24 px tall on the shared grid', () => {
    for (const b of buttons(render())) expect(b.tag).toMatch(/class="sp-floorlist__row sp-flabel ?(is-hot)?"/);
  });

  it('lights the label of the floor pointed at on the model', () => {
    const hot = buttons(render('F2')).filter((b) => b.tag.includes('is-hot'));
    expect(hot.length).toBe(1);
    expect(hot[0].tag).toContain('data-floor="F2"');
    expect(buttons(render()).some((b) => b.tag.includes('is-hot'))).toBe(false);
  });
});
