// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors, segmentIndex } from '../../domain/derive';
import { computeKpis, kpiDeltas } from '../../domain/kpis';
import { rollover } from '../../domain/rollover';
import { legendFor } from '../../domain/lenses';
import { findIssues, issueCounts, recentChanges } from '../../domain/issues';
import { timelineModel } from '../../domain/timeline';
import { parseState } from '../../state/planState';
import type { PlanModel } from '../../model/usePlanModel';
import TimelineView from './TimelineView';
import { MiniTimeline } from './MiniTimeline';

// jsdom-free: the view guards ResizeObserver, but keep the global so the hook path is exercised.
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function buildModel(asOf: string, safe: boolean): PlanModel {
  const today = TODAY;
  const floors = deriveFloors(property, asOf, today);
  const floorsToday = asOf === today ? floors : deriveFloors(property, today, today);
  const kpis = computeKpis(property, floors, asOf);
  const kpisToday = asOf === today ? kpis : computeKpis(property, floorsToday, today);
  const issues = findIssues(property, floors, today);
  return {
    property,
    today,
    asOf,
    safe,
    isProjected: asOf !== today,
    floors,
    segIndex: segmentIndex(floors),
    kpis,
    kpisToday,
    deltas: asOf === today ? null : kpiDeltas(kpis, kpisToday),
    roll: rollover(floors, asOf, 'rolling', 8),
    issues,
    counts: issueCounts(issues),
    changes: recentChanges(property, today, 30),
    legend: legendFor('status', safe, floors),
    req: null,
    fits: null,
    worklist: () => [],
    activeWorklist: null,
    searchMatches: null,
    bucketKeys: null,
    highlight: null,
    filterLabel: null,
    timeline: timelineModel(property, floors, asOf, today),
    selected: null,
    selectedFloor: null,
    anyEnlarged: false,
  };
}

const tenantNames = Array.from(new Set(property.leases.map((l) => l.tenant)));

describe('TimelineView', () => {
  it('renders the slider, one row per floor and tenant names', () => {
    const model = buildModel(TODAY, false);
    const html = renderToString(<TimelineView model={model} state={parseState('', TODAY)} patch={() => {}} />);
    expect(html).toContain('role="slider"');
    expect(html.match(/class="sp-tl-row"/g)?.length).toBe(12);
    expect(model.timeline.rows.length).toBe(12);
    expect(html).toContain('Cirrus Energy');
    // Rollover band: nine columns (8 buckets + tail), the first labelled "< 12 mo".
    expect(html.match(/class="sp-tl-band__col/g)?.length).toBe(9);
    expect(html).toContain('&lt; 12 mo');
    // The handle shows the month and the slider the full date.
    expect(html).toContain('Nov 2026');
    expect(html).toContain('aria-valuetext="Nov 9, 2026"');
  });

  it('hides every tenant name in prospect-safe mode', () => {
    const model = buildModel(TODAY, true);
    const html = renderToString(<TimelineView model={model} state={parseState('?safe=1', TODAY)} patch={() => {}} />);
    for (const name of tenantNames) expect(html, name).not.toContain(name);
    expect(html).toContain('role="slider"');
  });

  it('shows the Today marker, holdover and projected extensions when time-travelling', () => {
    const asOf = '2028-01-01';
    const model = buildModel(asOf, false);
    const html = renderToString(<TimelineView model={model} state={parseState(`?asOf=${asOf}&lens=expiry`, TODAY)} patch={() => {}} />);
    expect(html).toContain('>Today<');
    expect(html).toContain('Jan 2028');
    expect(html).toContain('sp-tl-bar--projected');
  });

  it('marks the selected bar and dims the rest of a highlight set', () => {
    const base = buildModel(TODAY, false);
    const first = base.timeline.rows.flatMap((r) => r.bars)[0];
    const model: PlanModel = { ...base, highlight: new Set([first.segKey]) };
    const html = renderToString(<TimelineView model={model} state={{ ...parseState('', TODAY), select: first.segKey }} patch={() => {}} />);
    expect(html).toContain('is-selected');
    expect(html).toContain('is-dim');
  });
});

describe('MiniTimeline', () => {
  it('renders a compact slider with bars and no text labels', () => {
    const model = buildModel(TODAY, false);
    const html = renderToString(<MiniTimeline model={model} asOf={TODAY} onChange={() => {}} />);
    expect(html).toContain('role="slider"');
    expect(html).toContain('sp-cursor--compact');
    expect(html).not.toContain('Cirrus Energy');
    expect(html).toContain('width="300"');
    expect(html).toContain('height="56"');
  });
});
