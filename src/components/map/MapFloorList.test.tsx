// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors, type FloorView } from '../../domain/derive';
import { computeKpis } from '../../domain/kpis';
import type { LensId } from '../../domain/lenses';
import { safeFloors } from '../../domain/safe';
import { FloorLabels, type FloorLabelRow } from '../building/FloorLabels';
import { floorLabel, floorLabelParts, floorLabelText, floorSentence } from '../building/floorFact';
import { MapFloorList } from './MapFloorList';

/**
 * One floor label, two lists. The list beside the Building view's model and the Map view's floor list
 * disagreed in three rounds running (a sublease named in one and not the other; the space on offer
 * dropped in the expiration lens; "Month-to-month" beside "· holdover"). Both now print a floor through
 * one component from one function, and this test renders both lists for every lens, for the broker and
 * for a prospect, and compares what each floor's row shows, to the letter.
 */

const LENSES: LensId[] = ['status', 'expiry', 'deals', 'rent'];
const floorsFor = (safe: boolean): FloorView[] => safeFloors(deriveFloors(property, TODAY, TODAY), safe);
const largestId = computeKpis(property, deriveFloors(property, TODAY, TODAY), TODAY).maxContiguous.floorId;

/** Each button's floor and visible text, in list order. Tags are dropped; nothing else is touched. */
function rowsOf(html: string, cls: string): Array<{ id: string; text: string; tag: string }> {
  return [...html.matchAll(new RegExp(`(<button[^>]*class="[^"]*${cls}[^"]*"[^>]*>)(.*?)</button>`, 'g'))].map((m) => ({
    id: /data-floor="([^"]+)"/.exec(m[1])![1],
    tag: m[1],
    text: m[2]
      .replace(/<!-- -->/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&#x27;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&'),
  }));
}

/** The Building view's rows, built as BuildingView builds them. */
function buildingRows(floors: FloorView[], lens: LensId, safe: boolean): FloorLabelRow[] {
  return floors.map((f) => {
    const largest = f.floor.id === largestId;
    return { id: f.floor.id, share: f.leasable > 0 ? f.leased / f.leasable : 0, parts: floorLabelParts(f, lens, safe, largest), name: floorLabel(f, lens, safe, largest), title: floorSentence(f, TODAY, safe) };
  });
}

const building = (lens: LensId, safe: boolean) => rowsOf(renderToString(<FloorLabels rows={buildingRows(floorsFor(safe), lens, safe)} hotId={null} onPick={() => {}} onPreview={() => {}} />), 'sp-flabel');
const map = (lens: LensId, safe: boolean, selected: string | null = null) =>
  rowsOf(renderToString(<MapFloorList floors={floorsFor(safe)} lens={lens} safe={safe} asOf={TODAY} selected={selected} largestId={largestId} onSelect={() => {}} />), 'sp-map-floor');

describe('the Building view\'s list of floors and the Map view\'s floor list', () => {
  for (const safe of [false, true])
    for (const lens of LENSES)
      it(`print the same label for every floor: ${lens} lens${safe ? ', prospect-safe' : ''}`, () => {
        const b = building(lens, safe);
        const m = map(lens, safe);
        expect(b.length).toBe(property.floors.length);
        expect(m.map((r) => r.id)).toEqual(b.map((r) => r.id));
        for (const [i, row] of b.entries()) {
          // The same text, the same order of parts, the same capitalisation.
          expect(m[i].text, `${row.id}`).toBe(row.text);
          // And it is the label's one line: nothing is added to it in either list.
          const f = floorsFor(safe).find((x) => x.floor.id === row.id)!;
          expect(row.text.replace(/ /g, ' ')).toBe(floorLabelText(floorLabelParts(f, lens, safe, f.floor.id === largestId)).replace(/ /g, ' '));
        }
      });

  it('print it through the same markup, so the type and the columns are the same', () => {
    const strip = (html: string) => [...html.matchAll(/<span class="sp-flabel__num">.*?<\/button>/g)].map((m) => m[0]);
    for (const lens of LENSES) {
      const b = strip(renderToString(<FloorLabels rows={buildingRows(floorsFor(false), lens, false)} hotId={null} onPick={() => {}} onPreview={() => {}} />));
      const m = strip(renderToString(<MapFloorList floors={floorsFor(false)} lens={lens} safe={false} asOf={TODAY} selected={null} largestId={largestId} onSelect={() => {}} />));
      expect(m).toEqual(b);
    }
    for (const row of [...building('status', false), ...map('status', false)]) expect(row.tag).toContain('sp-floorlist__row');
  });

  it('say what round 15 found missing: the space in the expiration lens, a sublease by name, one wording', () => {
    const text = (rows: Array<{ id: string; text: string }>, id: string) => rows.find((r) => r.id === id)!.text.replace(/ /g, ' ');
    for (const list of [building, map]) {
      expect(text(list('expiry', false), 'F8')).toBe("8 · 65.4% leased · 7,400 SF available · expires Dec '33");
      // Round 16: every floor with a lease says when it expires; holdover and month-to-month each by name.
      expect(text(list('expiry', false), 'F9')).toBe("9 · 100.0% leased · expires May '30");
      expect(text(list('expiry', false), 'F11')).toBe("11 · 100.0% leased · expires May '30 – Jan '32");
      expect(text(list('expiry', false), 'F3')).toBe("3 · 74.3% leased · 5,500 SF available · holdover · expires Jun '29");
      expect(text(list('expiry', false), 'F2')).toBe("2 · 74.8% leased · month-to-month · expires Dec '31");
      // Round 16: the rent beside space on offer is the asking rent of that space, and says so.
      expect(text(list('rent', false), 'F12')).toBe('12 · 50.0% leased · 9,300 SF available · asking $38–$40/SF/yr FSG Largest block');
      expect(text(list('rent', false), 'F10')).toBe('10 · 100.0% leased · in place $31/SF/yr FSG');
      for (const row of list('rent', true)) expect(row.text, row.id).not.toMatch(/in place/);
      expect(text(list('expiry', false), 'F12')).toBe("12 · 50.0% leased · 9,300 SF available · expires Jun '28 Largest block");
      expect(text(list('status', false), 'F7')).toBe('7 · 100.0% leased · 7,000 SF sublease available');
      expect(text(list('status', false), 'F2')).toBe('2 · 74.8% leased · month-to-month');
      expect(text(list('status', false), 'F6')).toBe('6 · 100.0% leased · expires < 12 mo');
      expect(text(list('status', false), 'F3')).toBe('3 · 74.3% leased · 5,500 SF available · holdover');
      // A prospect is shown no risk, expiry or deal word in either list.
      for (const lens of LENSES) for (const row of list(lens, true)) expect(row.text, `${lens} ${row.id}`).not.toMatch(/holdover|month-to-month|MTM|expires|live deal/i);
    }
  });
});

describe('MapFloorList', () => {
  it('names each row with the Building label\'s name, then what the map adds', () => {
    const rows = map('status', false);
    const tag = (id: string) => rows.find((r) => r.id === id)!.tag.replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    expect(tag('F12')).toContain('aria-label="Floor 12, 50.0% leased, 9,300 SF available, largest block. 18,600 RSF leasable, mostly ');
    expect(tag('F7')).toContain('aria-label="Floor 7, 100.0% leased, 7,000 SF sublease available. ');
    expect(tag('F1')).toMatch(/aria-label="Floor 1, [^"]*also: 2,600 SF for sale"/);
    expect(tag('F12')).toContain('title="Floor 12 · 18,600 RSF leasable · 50.0% leased · 9,300 SF available · the largest block in the building · mostly ');
  });

  it('is one tab stop: the open floor, else the top floor; the open floor is the pressed one', () => {
    const stops = (rows: Array<{ id: string; tag: string }>) => rows.filter((r) => r.tag.includes('tabindex="0"')).map((r) => r.id);
    expect(stops(map('status', false))).toEqual(['F12']);
    expect(stops(map('status', false, 'F8'))).toEqual(['F8']);
    expect(map('status', false, 'F8').filter((r) => r.tag.includes('aria-pressed="true"')).map((r) => r.id)).toEqual(['F8']);
  });

  it('draws the swatch in the colour of the fact the row names: on the expiration lens, the step of the first expiry', () => {
    const html = renderToString(<MapFloorList floors={floorsFor(false)} lens="expiry" safe={false} asOf={TODAY} selected={null} largestId={largestId} onSelect={() => {}} />);
    const swatch = (id: string) => new RegExp(`data-floor="${id}"[^>]*>(?:<!-- -->)?<span class="sp-map-floor__swatch" style="([^"]*)"`).exec(html)![1];
    // Floor 5 reads "expires Apr '27 – Sep '28": the "< 6 mo" step, not the "1–2 yr" that colours most of the floor.
    expect(swatch('F5')).toContain('var(--tone-exp-0-fill)');
    expect(swatch('F5')).not.toContain('exp-2');
    expect(swatch('F1')).toContain('var(--tone-exp-0-fill)');
    // Floor 3: the step of its dated lease, and the at-risk colour for its holdover, which the row also names.
    expect(swatch('F3')).toContain('var(--tone-exp-3-fill)');
    expect(swatch('F3')).toContain('var(--tone-risk-edge)');
  });

  it('gives each row a tooltip that is the Building label\'s tooltip, then what the map adds', () => {
    const tag = (lens: LensId, id: string) => map(lens, false).find((r) => r.id === id)!.tag.replace(/&#x27;/g, "'");
    expect(tag('rent', 'F12')).toContain('title="Floor 12 · 18,600 RSF leasable · 50.0% leased · 9,300 SF available · asking $38–$40/SF/yr FSG · in place $36/SF/yr FSG · the largest block in the building · mostly ');
    expect(tag('expiry', 'F11').replace(/\u00a0/g, ' ')).toContain("title=\"Floor 11 · 20,800 RSF leasable · 100.0% leased · 0 SF available · expires May '30 – Jan '32 · mostly ");
  });

  it('gives the swatch a second colour where the floor holds an at-risk lease, and none for a prospect', () => {
    const html = (safe: boolean) => renderToString(<MapFloorList floors={floorsFor(safe)} lens="status" safe={safe} asOf={TODAY} selected={null} largestId={largestId} onSelect={() => {}} />);
    expect(html(false)).toContain('linear-gradient');
    expect(html(true)).not.toContain('linear-gradient');
  });
});
