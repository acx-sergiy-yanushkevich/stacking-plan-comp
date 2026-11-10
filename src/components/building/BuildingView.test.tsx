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

/** The floor named in the floor column's heading. */
const shownFloor = (html: string) => html.match(/<h3 class="sp-floor__h">([^<]+)<\/h3>/)?.[1];

describe('BuildingView', () => {
  it('is the default view', () => {
    expect(parseState('', TODAY).view).toBe('building');
  });

  it('opens on the floor with the most available space, with the model, a plate and the floor summary', () => {
    const html = render('');
    expect(shownFloor(html)).toBe('Floor 12');
    expect(html).toContain('Most space available');
    expect(html).toContain('sp-hero--stage');
    expect(html).toContain('Floor 12 plate, schematic');
    expect(html).toContain('Largest contiguous');
    expect(html).toContain('aria-label="Floors"');
  });

  it('shows the pinned floor and offers to unpin it', () => {
    const html = render('?floor=F6');
    expect(shownFloor(html)).toBe('Floor 6');
    expect(html).toContain('Cirrus Energy');
    expect(html).toContain('Pinned');
    expect(html).toContain('Unpin');
  });

  it('opens on the first floor a search or the finder is lighting', () => {
    const base = buildModel(parseState('', TODAY));
    const f3 = base.floors.find((f) => f.floor.id === 'F3')!;
    const html = render('', { highlight: new Set([f3.segments[0].key]) });
    expect(shownFloor(html)).toBe('Floor 3');
    expect(html).toContain('First match');
  });

  it('numbers every floor on the model', () => {
    const html = render('');
    const tags = html.match(/class="sp-hero__tag[^"]*"/g) ?? [];
    expect(tags.length).toBe(property.floors.length);
  });

  it('prospect-safe mode names no tenant', () => {
    const html = render('?floor=F6&safe=1');
    expect(shownFloor(html)).toBe('Floor 6');
    expect(html).not.toContain('Cirrus Energy');
  });
});
