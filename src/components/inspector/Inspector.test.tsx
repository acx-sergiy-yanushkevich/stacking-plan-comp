// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { property, TODAY } from '../../data/mock/property';
import { activeDeals, deriveFloors, isLeaseKind, segmentIndex, type FloorView } from '../../domain/derive';
import { computeKpis, kpiDeltas } from '../../domain/kpis';
import { rollover } from '../../domain/rollover';
import { legendFor } from '../../domain/lenses';
import { findFits, filterFits } from '../../domain/finder';
import { findIssues, issueCounts, recentChanges } from '../../domain/issues';
import { timelineModel } from '../../domain/timeline';
import { WINDOW_MONTHS, type PlanModel, type WorklistRow } from '../../model/usePlanModel';
import { deriveMode, parseState, type PlanState, type WindowKey } from '../../state/planState';
import Inspector from './Inspector';

/** Same derivation as `usePlanModel`, without the hook, so the panels can be rendered to a string. */
function buildModel(state: PlanState): PlanModel {
  const asOf = state.asOf;
  const floors = deriveFloors(property, asOf, TODAY);
  const floorsToday = asOf === TODAY ? floors : deriveFloors(property, TODAY, TODAY);
  const kpis = computeKpis(property, floors, asOf);
  const kpisToday = asOf === TODAY ? kpis : computeKpis(property, floorsToday, TODAY);
  const roll = rollover(floors, asOf, 'rolling', 8);
  const issues = findIssues(property, floors, TODAY);
  const inquiry = state.inquiry ? property.inquiries.find((i) => i.id === state.inquiry) ?? null : null;
  const req = inquiry
    ? { size: inquiry.minSize, max: inquiry.maxSize, by: inquiry.neededBy, type: 'any' as const }
    : state.req
      ? { size: state.req, max: state.max, by: state.by, type: state.fit }
      : null;
  const fits = req
    ? (() => {
        const r = findFits(floors, req.size, req.by, req.max, property.inquiries, asOf);
        const options = filterFits(r.options, req.type);
        return { options, keys: new Set(options.flatMap((o) => o.keys)), largestNow: r.largestNow };
      })()
    : null;
  const worklist = (w: WindowKey): WorklistRow[] => rowsFor(floors, w);
  const segIndex = segmentIndex(floors);
  const selected = state.select ? segIndex.get(state.select) ?? null : null;
  const selectedFloor = state.floor ? floors.find((f) => f.floor.id === state.floor) ?? null : selected ? floors.find((f) => f.floor.id === selected.floorId) ?? null : null;
  return {
    property,
    today: TODAY,
    asOf,
    safe: state.safe,
    isProjected: asOf !== TODAY,
    floors,
    segIndex,
    kpis,
    kpisToday,
    deltas: asOf === TODAY ? null : kpiDeltas(kpis, kpisToday),
    roll,
    issues,
    counts: issueCounts(issues),
    changes: recentChanges(property, TODAY, 30),
    legend: legendFor(state.lens, state.safe, floors),
    req,
    fits,
    worklist,
    activeWorklist: state.window ? worklist(state.window) : null,
    searchReasons: null,
    searchMatches: null,
    bucketKeys: null,
    highlight: fits?.keys ?? null,
    filterLabel: null,
    timeline: timelineModel(property, floors, asOf, TODAY),
    selected,
    selectedFloor,
    anyEnlarged: false,
  };
}

function rowsFor(floors: FloorView[], window: WindowKey): WorklistRow[] {
  const rows: WorklistRow[] = [];
  for (const f of floors) {
    for (const s of f.segments) {
      if (!s.lease || !isLeaseKind(s.kind)) continue;
      const risk = s.kind === 'holdover' || s.kind === 'mtm';
      const months = s.kind === 'sublease' ? (s.headMonths ?? s.monthsToExpiry) : s.monthsToExpiry;
      const inWindow = window === 'risk' ? risk : !risk && months !== null && months <= WINDOW_MONTHS[window];
      if (!inWindow) continue;
      rows.push({
        segKey: s.key,
        floorId: f.floor.id,
        floorName: f.floor.name,
        suite: s.suite ?? '',
        tenant: s.lease.tenant,
        size: s.size,
        months: s.kind === 'mtm' ? null : months,
        endDate: s.endDate,
        kind: s.kind,
        broker: s.lease.owner,
        lastTouch: s.lease.lastTouch,
        renewal: activeDeals(s.lease.deals).find((d) => d.kind === 'Renewal') ?? null,
        seg: s,
      });
    }
  }
  return rows.sort((a, b) => (a.months ?? -1) - (b.months ?? -1) || b.size - a.size);
}

function render(search: string) {
  const state = parseState(search, TODAY);
  const model = buildModel(state);
  const html = renderToString(<Inspector model={model} state={state} patch={() => {}} mode={deriveMode(state)} />);
  return { html, model, state };
}

const TENANTS = ['Cirrus Energy', 'Anadarko', 'Argosy', 'Bowline', 'Hanover', 'Halcyon', 'Delta Dental', 'Lumen', 'Kinetic', 'Vantage Robotics', 'Orchid Bio', 'Northwind'];
const expectNoTenants = (html: string) => {
  for (const t of TENANTS) expect(html, `leaks "${t}"`).not.toContain(t);
};

describe('Inspector', () => {
  it('Building: rollover, at risk, supply, pipeline, issues, changes', () => {
    const { html } = render('');
    expect(html).toContain('Rollover');
    expect(html).toContain('At risk');
    expect(html).toContain('Coming supply');
    expect(html).toContain('Pipeline by stage');
    expect(html).toContain('Data issues');
    expect(html).toContain('Recent changes');
    expect(html).toContain('Cirrus Energy'); // most recent change
    expect(html).toContain('Term Expiration Date');
    expect(html).toContain('role="button"'); // chart bars
    expect(html).toContain('&lt; 12 mo');
  });

  it('Block (lease): tenant, term, rent, broker, deals, actions', () => {
    const { html } = render('?select=L13-U1');
    expect(html).toContain('Cirrus Energy');
    expect(html).toContain('Tom Conner');
    expect(html).toContain('$29/SF/yr FSG');
    expect(html).toContain('Dana Whitfield');
    expect(html).toContain('Marketed for later');
    expect(html).toContain('Vantage Robotics');
    expect(html).toContain('Open lease');
    expect(html).toContain('Start renewal');
    expect(html).toContain('21,400 SF');
  });

  it('Block (availability): asking range, divisible, inquiries, deals', () => {
    const { html } = render('?select=A02');
    expect(html).toContain('Direct');
    expect(html).toContain('$30–$32/SF/yr FSG');
    expect(html).toContain('min 2,500 SF');
    expect(html).toContain('Northwind Health');
    expect(html).toContain('Open availability');
  });

  it('Block (gap): suspect lease and Add unit', () => {
    const { html } = render('?select=F2-gap');
    expect(html).toContain('unaccounted');
    expect(html).toContain('Delta Dental Plan');
    expect(html).toContain('Add unit');
  });

  it('Block (for sale) and committed', () => {
    expect(render('?select=A10').html).toContain('Asking price');
    expect(render('?select=L09-U1').html).toContain('Signed lease');
  });

  it('Floor: KPIs, suites, floor plate', () => {
    const { html } = render('?floor=F3');
    expect(html).toContain('Floor 3');
    expect(html).toContain('Largest contiguous');
    expect(html).toContain('Open floor plate');
    expect(html).toContain('Argosy Partners');
  });

  it('Find: results and empty state', () => {
    const r = render('?req=12000');
    expect(r.html).toContain('Find space');
    expect(r.html).toContain('Largest block now');
    expect(r.html).toContain('Options ·');
    expect(r.model.fits!.options.length).toBeGreaterThan(0);
    const e = render('?req=90000');
    expect(e.html).toContain('No space fits 90,000 SF');
    expect(e.html).toContain('Try 12 months later');
    const i = render('?inquiry=I02');
    expect(i.html).toContain('Options');
  });

  it('Worklist: window chips, rows, export', () => {
    const { html } = render('?window=12');
    expect(html).toContain('12 months');
    expect(html).toContain('Renewal worklist');
    expect(html).toContain('Export CSV');
    expect(html).toContain('Cirrus Energy');
    const risk = render('?window=risk').html;
    expect(risk).toContain('Holdover');
    expect(risk).toContain('MTM');
  });

  it('Issues: grouped with fix and locate', () => {
    const { html } = render('?mode=issues');
    expect(html).toContain('Errors ·');
    expect(html).toContain('Locate');
    expect(html).toContain('Add unit');
    expect(html).toContain('over-allocated');
  });

  it('Prospect-safe hides tenants, contacts, rents and prospects everywhere', () => {
    for (const q of ['?safe=1', '?safe=1&select=L13-U1', '?safe=1&select=A02', '?safe=1&select=F2-gap', '?safe=1&floor=F6', '?safe=1&req=12000', '?safe=1&window=12', '?safe=1&mode=issues']) {
      const { html } = render(q);
      expectNoTenants(html);
      // In-place rents never appear; asking rents on vacancies may ("Asking $30–$32/SF/yr FSG").
      expect(html.replace(/Asking \$[^<]*?\/SF\/(yr|mo) (FSG|MG|NNN)/g, ''), `${q} leaks a rate`).not.toContain('/SF/yr');
      expect(html, `${q} leaks a contact`).not.toContain('Tom Conner');
    }
  });

  it('Area mode renders the supplied panel or a placeholder', () => {
    const state = parseState('?mode=area', TODAY);
    const model = buildModel(state);
    expect(renderToString(<Inspector model={model} state={state} patch={() => {}} mode="area" />)).toContain('Area');
    expect(renderToString(<Inspector model={model} state={state} patch={() => {}} mode="area" areaPanel={<div>Demographics here</div>} />)).toContain('Demographics here');
  });
});
