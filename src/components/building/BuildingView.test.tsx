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

const render = (search: string, over: Partial<PlanModel> = {}, kpiColumn?: boolean) => {
  const state = parseState(search, TODAY);
  const model = { ...buildModel(state), ...over };
  return renderToString(<BuildingView model={model} state={state} patch={() => {}} kpiColumn={kpiColumn} />);
};
/** The KPI column as rendered: the `<section>` of six cards. */
const kpiColumnOf = (html: string) => /<section class="sp-kpis sp-kpis--col[^"]*".*?<\/section>/.exec(html)?.[0] ?? '';
/** The quick starts, as their buttons' text. */
const startsOf = (html: string) => [...(/aria-label="Floors with the most space">(.*?)<\/div>/.exec(html)?.[1] ?? '').matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((m) => m[1].replace(/<!-- -->/g, ''));

/** The floor named in the floor column's heading; undefined while the building stands alone. */
const shownFloor = (html: string) => html.match(/<h3 class="sp-floor__h">([^<]+)<\/h3>/)?.[1];
/** The accessible names of the picker's rows, top floor first. */
const pickerNames = (html: string) => [...html.matchAll(/class="sp-mini__row[^"]*" aria-label="([^"]+)"/g)].map((m) => m[1]);

describe('BuildingView', () => {
  it('is the default view', () => {
    expect(parseState('', TODAY).view).toBe('building');
  });

  it('stands alone with no floor open: the building\'s KPIs and quick starts beside the turned model, no plate', () => {
    const html = render('');
    expect(shownFloor(html)).toBeUndefined();
    expect(html).toContain('is-alone');
    expect(html).toContain('sp-hero--stage');
    expect(html).toContain('sp-hero--facts');
    expect(html).toContain('9,300 SF available');
    // The six KPIs stand in the column beside the model (the strip above the plan is hidden by the app).
    expect(html).toContain('sp-kpis--col');
    expect(html).toContain('has-kpis');
    expect(html.match(/class="sp-kpi__label sp-label"/g)?.length).toBe(6);
    expect(html).toContain('aria-label="Floors with the most space"');
    expect(html).toContain('aria-label="Floors"');
    expect(html).toContain('Point at a floor for its numbers');
    expect(html).not.toContain('Pick a floor');
    expect(html).not.toContain('plate, schematic');
  });

  it('opens the pinned floor beside the docked model and offers the whole building back', () => {
    const html = render('?floor=F6');
    expect(shownFloor(html)).toBe('Floor 6');
    expect(html).toContain('is-docked');
    expect(html).not.toContain('is-alone');
    expect(html).not.toContain('sp-hero--facts');
    // Docked, the KPIs are still the column on the left: three columns, the floor's pane on the right.
    expect(html).toContain('sp-kpis--col');
    expect(html).toContain('has-kpis');
    expect(html).toContain('Cirrus Energy');
    expect(html).toContain('Floor 6 plate, schematic');
    expect(html).toContain('Largest contiguous');
    expect(html).toContain('Whole building');
    // A floor the user opened carries no status word.
    for (const jargon of ['Pinned', 'Preview', 'First match', 'First floor that matches']) expect(html).not.toContain(jargon);
    // Nothing is free today, but the floor is marketed for later: say when, not "0 SF available".
    expect(html).toContain('21,400 SF marketed from Apr &#x27;27');
    // The listing is unpublished, so a prospect sees the floor as leased.
    expect(render('?floor=F6&safe=1')).not.toContain('marketed from');
  });

  it('keeps the KPI column and the quick starts exactly as they are when a floor opens or closes', () => {
    const alone = render('');
    const docked = render('?floor=F8');
    // The same six cards, byte for byte: nothing in the column depends on whether a floor is open.
    expect(kpiColumnOf(alone).length).toBeGreaterThan(500);
    expect(kpiColumnOf(docked)).toBe(kpiColumnOf(alone));
    // The quick starts stay under them and now switch floors; the open floor's button is pressed.
    expect(startsOf(alone)).toEqual(['Floor 12 · 9,300 SF', 'Floor 8 · 7,400 SF', 'Floor 7 · 7,000 SF']);
    expect(startsOf(docked)).toEqual(startsOf(alone));
    expect(alone.match(/<button[^>]*aria-pressed="true"[^>]*>Floor/g)).toBeNull();
    expect(docked).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Floor 8<!-- --> · <!-- -->7,400 SF<\/button>/);
    // The column is the first thing in the grid in both states (the same place in the tree, so React keeps the element).
    for (const html of [alone, docked]) expect(html).toMatch(/<div class="sp-bview__grid [^"]*"><div class="sp-bview__side"><section class="sp-kpis sp-kpis--col/);
  });

  it('has no KPI column where the app shows the KPIs above the plan, in either state', () => {
    const alone = render('', {}, false);
    const docked = render('?floor=F8', {}, false);
    for (const html of [alone, docked]) {
      expect(html).not.toContain('sp-kpis--col');
      expect(html).not.toContain('has-kpis');
      expect(html).not.toContain('sp-kpi__label');
    }
    // Alone, the quick starts are a line above the model; with a floor open the picker is the way between floors.
    expect(startsOf(alone)).toEqual(['Floor 12 · 9,300 SF', 'Floor 8 · 7,400 SF', 'Floor 7 · 7,000 SF']);
    expect(docked).not.toContain('Floors with the most space');
    expect(shownFloor(docked)).toBe('Floor 8');
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

  it('numbers every floor on the model', () => {
    const html = render('');
    const tags = html.match(/class="sp-hero__tag(?: [^"]*)?"/g) ?? [];
    expect(tags.length).toBe(property.floors.length);
  });

  it('puts each floor\'s facts in its picker row\'s accessible name and tooltip, in every lens', () => {
    expect(pickerNames(render(''))).toContain('Floor 8, 65.4% leased, 7,400 SF available');
    expect(pickerNames(render(''))).toContain('Floor 3, 74.3% leased, 5,500 SF available, holdover');
    expect(pickerNames(render('?lens=expiry'))).toContain('Floor 6, 100.0% leased, Expires Mar &#x27;27');
    expect(pickerNames(render('?lens=deals'))).toContain('Floor 6, 100.0% leased, 2 live deals · LOI');
    expect(pickerNames(render('?lens=rent'))).toContain('Floor 5, 100.0% leased, $30–$31/SF/yr FSG · $26.50/SF/yr MG');
    const html = render('?lens=rent');
    expect(html).toContain('title="Floor 5, 100.0% leased, $30–$31/SF/yr FSG · $26.50/SF/yr MG"');
  });

  it('prints the lens fact beside each floor of the model and says what the facts are', () => {
    const rent = render('?lens=rent');
    expect(rent).toContain(' · $42/SF/yr NNN · $3.25/SF/mo NNN');
    expect(rent).toContain('recorded in-place rent by lease type');
    const deals = render('?lens=deals');
    expect(deals).toContain(' · 3 live deals · LOI');
    const expiry = render('?lens=expiry');
    expect(expiry).toContain('next lease expiry within 24 months');
    expect(render('')).toContain(' · 5,500 SF available · holdover');
  });

  it('points the model\'s label at the floor picker, which is on screen here; the stack is not', () => {
    const html = render('');
    expect(html).toMatch(/role="img" aria-label="Building model: 12 floors[^"]*floor picker beside it[^"]*"/);
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
    // The note under the model describes asking rents; the in-place wording is gone with the in-place rents.
    expect(rent).toContain('the asking rent of the space on offer');
    expect(rent).not.toContain('recorded in-place rent');
    const status = render('?safe=1');
    for (const word of ['holdover', 'Holdover', 'month-to-month', 'Month-to-month', 'expires &lt; 12 mo', 'Expires &lt; 12 mo', 'live deal']) expect(status).not.toContain(word);
    expect(status).toContain('Withheld');
    expect(status).not.toContain('suites and deals');
  });
});
