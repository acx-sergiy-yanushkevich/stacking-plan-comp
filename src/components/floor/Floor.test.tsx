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
import FloorView from './FloorView';

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

const render = (search: string) => {
  const state = parseState(search, TODAY);
  const model = buildModel(state);
  return renderToString(<FloorView model={model} state={state} patch={() => {}} />);
};

describe('FloorView', () => {
  it('renders Floor 6 with its tenant and a sliced plate', () => {
    const html = render('?view=floor&floor=F6');
    expect(html).toContain('Floor 6');
    expect(html).toContain('Cirrus Energy');
    expect(html).toContain('<path');
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('Floor 6 plate, schematic');
    expect(html).toContain('OpenStreetMap');
  });

  it('hides every tenant and prospect name in prospect-safe mode', () => {
    const html = render('?view=floor&floor=F6&safe=1');
    expect(html).toContain('Floor 6');
    const names = [
      ...property.leases.map((l) => l.tenant),
      ...property.leases.flatMap((l) => l.deals.map((d) => d.prospect)),
      ...property.availabilities.flatMap((a) => a.deals.map((d) => d.prospect)),
      ...property.inquiries.map((i) => i.prospect),
    ];
    for (const n of names) expect(html, `leaked "${n}"`).not.toContain(n);
  });

  it('renders every floor without throwing, including the over-allocated one', () => {
    for (const f of property.floors) {
      const html = render(`?view=floor&floor=${f.id}`);
      expect(html).toContain(f.name);
    }
    expect(render('?view=floor&floor=F7')).toContain('Over-allocated by');
  });
});
