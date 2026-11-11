// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors, segmentIndex } from '../../domain/derive';
import { computeKpis, kpiDeltas } from '../../domain/kpis';
import { rollover } from '../../domain/rollover';
import { findIssues, issueCounts, recentChanges } from '../../domain/issues';
import { legendFor } from '../../domain/lenses';
import { timelineModel } from '../../domain/timeline';
import { parseState, type PlanState } from '../../state/planState';
import type { PlanModel } from '../../model/usePlanModel';
import BuildingView from './BuildingView';

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

function buildModel(state: PlanState): PlanModel {
  const { asOf, safe, lens } = state;
  const floors = deriveFloors(property, asOf, TODAY);
  const kpis = computeKpis(property, floors, asOf);
  const issues = findIssues(property, floors, TODAY);
  return {
    property,
    today: TODAY,
    asOf,
    safe,
    isProjected: asOf !== TODAY,
    floors,
    segIndex: segmentIndex(floors),
    kpis,
    kpisToday: kpis,
    deltas: asOf === TODAY ? null : kpiDeltas(kpis, kpis),
    roll: rollover(floors, asOf, 'rolling', 8),
    issues,
    counts: issueCounts(issues),
    changes: recentChanges(property, TODAY, 30),
    legend: legendFor(lens, safe, floors),
    req: null,
    fits: null,
    worklist: () => [],
    activeWorklist: null,
    searchReasons: null,
    searchMatches: null,
    bucketKeys: null,
    highlight: null,
    filterLabel: null,
    timeline: timelineModel(property, floors, asOf, TODAY),
    selected: null,
    selectedFloor: floors.find((f) => f.floor.id === state.floor) ?? null,
    anyEnlarged: false,
  };
}

const render = (search: string, over: Partial<PlanModel> = {}) => {
  const state = parseState(search, TODAY);
  const model = { ...buildModel(state), ...over };
  return renderToString(<BuildingView model={model} state={state} patch={() => {}} />);
};
/** The entities React escapes turned back, and a non-breaking space read as a space. */
const plain = (t: string) => t.replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/ /g, ' ');
/** The labels beside the model, top floor first: each button's own tag and what it prints. */
const labelsOf = (html: string) =>
  [...html.matchAll(/(<button[^>]*class="sp-flabel[^>]*>)(.*?)<\/button>/g)].map((m) => ({ tag: plain(m[1]), text: plain(m[2].replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '')) }));
const labelTexts = (search: string) => labelsOf(render(search)).map((l) => l.text);
const floorOf = (l: { tag: string }) => /data-floor="([^"]+)"/.exec(l.tag)?.[1];

/** The floor named in the floor column's heading; undefined while the building stands alone. */
const shownFloor = (html: string) => html.match(/<h3 class="sp-floor__h">([^<]+)<\/h3>/)?.[1];
/** The accessible names of the docked picker's rows, top floor first. */
const pickerNames = (html: string) => [...html.matchAll(/class="sp-mini__row[^"]*" aria-label="([^"]+)"/g)].map((m) => plain(m[1]));
/** The accessible names of the labels beside the model, top floor first. */
const labelNames = (html: string) => labelsOf(html).map((l) => /aria-label="([^"]+)"/.exec(l.tag)?.[1] ?? '');

describe('BuildingView', () => {
  it('is the default view', () => {
    expect(parseState('', TODAY).view).toBe('building');
  });

  it('stands alone with no floor open: the turned model under one caption line, its floors listed once beside it, no plate', () => {
    const html = render('');
    expect(shownFloor(html)).toBeUndefined();
    expect(html).toContain('is-alone');
    expect(html).toContain('sp-hero--stage');
    expect(html).toContain('9,300 SF available');
    expect(html).toContain('Click a floor or its label to open its plan.');
    expect(html).not.toContain('plate, schematic');
    // One line above the model: the caption; the model's stage follows it.
    expect(html).toMatch(/<div class="sp-bview__model"><p class="sp-bview__caption">.*?<\/p><div class="sp-bview__stage/);
    // The floors are listed once: the labels beside the model. No second picker, and the model prints no number of its own.
    expect(html.match(/aria-label="Floors"/g)?.length).toBe(1);
    expect(html).not.toContain('sp-mini');
    expect(html.match(/class="sp-hero__tag(?: [^"]*)?"/g)).toBeNull();
    expect(labelsOf(html).length).toBe(property.floors.length);
  });

  it('has no quick starts: the space on every floor is on its label, one click away', () => {
    for (const html of [render(''), render('?lens=rent'), render('?safe=1'), render('?floor=F8')]) {
      expect(html).not.toContain('Most space');
      expect(html).not.toContain('Floors with the most space');
      expect(html).not.toContain('sp-bview__starts');
    }
  });

  it('labels each floor with its number, leased share and the lens fact, as a button', () => {
    const labels = labelsOf(render(''));
    expect(labels.map((l) => l.text).slice(0, 2)).toEqual(['12 · 50.0% leased · 9,300 SF available Largest block', '11 · 100.0% leased']);
    expect(labels.map((l) => l.text)).toContain('3 · 74.3% leased · 5,500 SF available · holdover');
    expect(labels.map((l) => l.text)).toContain('2 · 74.8% leased · month-to-month');
    // Top floor first, each a real button that names its floor and carries the full sentence as its tooltip.
    expect(labels.map(floorOf)).toEqual(property.floors.map((f) => f.id).reverse());
    for (const l of labels) expect(l.tag).toMatch(/^<button type="button"/);
    expect(labels[0].tag).toContain('aria-label="Floor 12, 50.0% leased, 9,300 SF available, largest block"');
    expect(labels[0].tag).toContain('title="Floor 12 · 18,600 RSF leasable · 50.0% leased · 9,300 SF available · the largest block in the building"');
    expect(labels[1].tag).toContain('aria-label="Floor 11, 100.0% leased"');
    expect(labels[4].tag).toContain('title="Floor 8 · 21,400 RSF leasable · 65.4% leased · 7,400 SF available"');
    // One tab stop: the top floor until another has had the keyboard.
    expect(labels.filter((l) => l.tag.includes('tabindex="0"')).length).toBe(1);
    expect(labels[0].tag).toContain('tabindex="0"');
  });

  it('tags the floor that holds the largest block, in words, in every lens and for a prospect', () => {
    for (const search of ['', '?lens=expiry', '?lens=deals', '?lens=rent', '?safe=1', '?safe=1&lens=rent']) {
      const tagged = labelsOf(render(search)).filter((l) => l.text.endsWith('Largest block'));
      expect(tagged.length, search).toBe(1);
      expect(floorOf(tagged[0]), search).toBe('F12');
      expect(tagged[0].tag, search).toMatch(/aria-label="Floor 12, [^"]*, largest block"/);
    }
    expect(render('')).toContain('<span class="sp-flabel__tag">Largest block</span>');
    // It follows the KPI: where the as-of date moves the largest block, the tag moves with it.
    const id = buildModel(parseState('?asOf=2028-01-01', TODAY)).kpis.maxContiguous.floorId;
    expect(id).not.toBeNull();
    expect(labelsOf(render('?asOf=2028-01-01')).filter((l) => l.text.endsWith('Largest block')).map(floorOf)).toEqual([id]);
  });

  it('opens the pinned floor beside the docked model and offers the whole building back', () => {
    const html = render('?floor=F6');
    expect(shownFloor(html)).toBe('Floor 6');
    expect(html).toContain('is-docked');
    expect(html).not.toContain('is-alone');
    // Docked, the compact picker is the list of floors: the labels beside the model are gone, and the model numbers the open floor alone.
    expect(html).not.toContain('sp-flabel');
    expect(html.match(/aria-label="Floors"/g)?.length).toBe(1);
    expect(html.match(/class="sp-hero__tag(?: [^"]*)?"/g)?.length).toBe(1);
    // Docked, the grid holds two things: the model with its picker, then the floor's pane.
    expect(html).toMatch(/<div class="sp-bview__grid is-docked[^"]*"><div class="sp-bview__model">.*?<\/div><div class="sp-bview__floor">/);
    expect(html).toContain('Cirrus Energy');
    expect(html).toContain('Floor 6 plate, schematic');
    expect(html).toContain('Largest contiguous');
    expect(html).toContain('Whole building');
    // A floor the user opened carries no status word.
    for (const jargon of ['Pinned', 'Preview', 'First match', 'First floor that matches']) expect(html).not.toContain(jargon);
    // Nothing is free today, but the floor is marketed for later: the heading says when.
    expect(plain(html)).toContain(`<p class="sp-floor__facts">21,400 RSF leasable · 21,400 SF marketed from Apr '27</p>`);
    // The listing is unpublished, so a prospect sees the floor as leased.
    expect(render('?floor=F6&safe=1')).not.toContain('marketed from');
  });

  it('heads an open floor with its name and size: the cards under the plate carry leased and available', () => {
    const html = render('?floor=F8');
    expect(shownFloor(html)).toBe('Floor 8');
    expect(html).toContain('<p class="sp-floor__facts">21,400 RSF leasable</p>');
    expect(html).toMatch(/<dt>Leased<\/dt><dd><span class="sp-fkpi__value sp-nb">65\.4%<\/span>/);
    expect(html).toMatch(/<dt>Available<\/dt><dd><span class="sp-fkpi__value sp-nb">7,400 SF<\/span>/);
    // The floor column says each once: no "65.4% leased" and no "7,400 SF available" sentence beside the name.
    const pane = html.slice(html.indexOf('<div class="sp-bview__floor">'));
    expect(pane).not.toContain('65.4% leased');
    expect(pane).not.toContain('7,400 SF available');
    // With a floor open there is no caption line: the picker is the way between floors.
    expect(html).not.toContain('sp-bview__caption');
  });

  it('holds no KPIs: the six are the bar above the toolbar, the same in every view', () => {
    for (const html of [render(''), render('?floor=F8'), render('?safe=1'), render('?asOf=2028-01-01')]) {
      expect(html).not.toContain('sp-kpi');
      expect(html).not.toContain('Key figures');
      expect(html).not.toContain('sp-bview__side');
    }
  });

  it('says how to read the colour ramp in the legend, where the lens has one', () => {
    expect(render('?lens=expiry')).toContain('Stronger colour = sooner expiry.');
    expect(render('?lens=rent')).toContain('Stronger blue = higher rent.');
    expect(render('')).not.toContain('Stronger');
    // Prospect-safe withholds lease terms: there is no ramp to explain.
    expect(render('?lens=expiry&safe=1')).not.toContain('Stronger colour');
  });

  it('explains an over-allocated floor beside the legend', () => {
    expect(render('')).toContain('Floor 7 records exceed its leasable area by 500 SF');
  });

  it('opens on the first floor a search or the finder is lighting, and says so in plain words', () => {
    const base = buildModel(parseState('', TODAY));
    const f3 = base.floors.find((f) => f.floor.id === 'F3')!;
    const html = render('', { highlight: new Set([f3.segments[0].key]) });
    expect(shownFloor(html)).toBe('Floor 3');
    expect(html).toContain('First floor that matches the filter');
    // The filter bar clears a filter; "Whole building" belongs to a floor the user opened.
    expect(html).not.toContain('Whole building');
  });

  it('keeps the open floor in the pane and in the picker: it is the only current row', () => {
    const html = render('?floor=F8');
    expect(html.match(/aria-current="true"/g)?.length).toBe(1);
    expect(html).toMatch(/class="sp-mini__row is-current[^"]*" aria-label="Floor 8, 65\.4% leased, 7,400 SF available" aria-current="true"/);
  });

  it('puts each floor\'s facts in its label\'s accessible name, in every lens, and in the docked picker\'s rows', () => {
    expect(labelNames(render(''))).toContain('Floor 8, 65.4% leased, 7,400 SF available');
    expect(labelNames(render(''))).toContain('Floor 3, 74.3% leased, 5,500 SF available, holdover');
    expect(labelNames(render('?lens=expiry'))).toContain("Floor 6, 100.0% leased, Expires Mar '27");
    expect(labelNames(render('?lens=deals'))).toContain('Floor 6, 100.0% leased, 2 live deals · LOI');
    expect(labelNames(render('?lens=rent'))).toContain('Floor 5, 100.0% leased, $30–$31/SF/yr FSG · $26.50/SF/yr MG');
    // The same names on the compact picker beside a docked model.
    expect(pickerNames(render('?floor=F8&lens=rent'))).toContain('Floor 5, 100.0% leased, $30–$31/SF/yr FSG · $26.50/SF/yr MG');
    expect(pickerNames(render('?floor=F8'))).toContain('Floor 12, 50.0% leased, 9,300 SF available, largest block');
  });

  it('prints the space on offer and the lens fact on each label, and says in the caption what the labels show', () => {
    expect(labelTexts('?lens=rent')).toContain('1 · 54.8% leased · 4,000 SF available · $42/SF/yr NNN · $3.25/SF/mo NNN');
    expect(render('?lens=rent')).toContain('in-place rent by lease type (confidential leases left out)');
    expect(labelTexts('?lens=deals')).toContain('3 · 74.3% leased · 5,500 SF available · 3 live deals · LOI');
    expect(render('?lens=deals')).toContain('live deals and the furthest stage reached');
    expect(render('?lens=expiry')).toContain('the next lease expiry within 24 months');
    expect(labelTexts('')).toContain('3 · 74.3% leased · 5,500 SF available · holdover');
    expect(render('')).toContain('holdover, month-to-month or an expiry within 12 months');
    // No figure is rounded and none is cut: every label holds the floor's exact leased share and available SF.
    const floors = buildModel(parseState('', TODAY)).floors;
    const texts = labelTexts('');
    for (const [i, f] of floors.entries()) {
      expect(texts[i]).toContain(`${((f.leased / f.leasable) * 100).toFixed(1)}% leased`);
      if (f.available > 0) expect(texts[i]).toContain(`${f.available.toLocaleString('en-US')} SF available`);
      else expect(texts[i]).not.toContain('SF available');
    }
  });

  it('points the model\'s label at the list of floors, which is on screen here; the stack is not', () => {
    const html = render('');
    expect(html).toMatch(/role="img" aria-label="Building model: 12 floors[^"]*list of floors beside it[^"]*"/);
    expect(html).not.toContain('The stack lists');
  });

  it('prospect-safe mode names no tenant', () => {
    const html = render('?floor=F6&safe=1');
    expect(shownFloor(html)).toBe('Floor 6');
    expect(html).not.toContain('Cirrus Energy');
  });

  it('prospect-safe mode shows asking rents only, and no risk, expiry or deal word beside a floor', () => {
    const rent = render('?safe=1&lens=rent');
    expect(rent).toContain('Asking $38–$40/SF/yr FSG');
    expect(rent).not.toContain('$36/SF/yr FSG');
    // The caption describes asking rents; the in-place wording is gone with the in-place rents.
    expect(rent).toContain('the asking rent of the space on offer');
    expect(rent).not.toContain('in-place rent');
    const status = render('?safe=1');
    for (const word of ['holdover', 'Holdover', 'month-to-month', 'Month-to-month', 'expires &lt; 12 mo', 'Expires &lt; 12 mo', 'expiry', 'live deal']) expect(status).not.toContain(word);
    // A prospect's labels: the leased share and the space on offer, as the picker's rows said before.
    expect(labelsOf(status).map((l) => l.text)).toContain('3 · 74.3% leased · 5,500 SF available');
    expect(labelsOf(status).map((l) => l.text)).toContain('2 · 74.8% leased');
    // (The withheld KPIs are the bar's own business: KpiStrip.test.tsx.)
  });
});
