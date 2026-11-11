import { property, TODAY } from '../../data/mock/property';
import { activeDeals, deriveFloors, isLeaseKind, segmentIndex, type FloorView } from '../../domain/derive';
import { checkNeededBy, searchSpace } from '../../domain/finder';
import { findIssues, issueCounts, recentChanges } from '../../domain/issues';
import { computeKpis, kpiDeltas } from '../../domain/kpis';
import { legendFor } from '../../domain/lenses';
import { rollover } from '../../domain/rollover';
import { canShowInquiries, canShowLeaseTerm, planDate, publishedFloors, safeFloors, safeKpis, safeRollover } from '../../domain/safe';
import { timelineModel } from '../../domain/timeline';
import { WINDOW_MONTHS, type PlanModel, type WorklistRow } from '../../model/usePlanModel';
import type { PlanState, WindowKey } from '../../state/planState';

/**
 * Test support: the same derivation as `usePlanModel` over the mock property, without the hook, so
 * views and panels can be rendered to a string. Imported by tests only; nothing in the app uses it.
 */
export function buildModel(state: PlanState): PlanModel {
  const asOf = planDate(state.asOf, TODAY, state.safe);
  // As in `usePlanModel`: totals keep the real lease terms; `floors` is the prospect-safe projection every view draws.
  const totals = publishedFloors(deriveFloors(property, asOf, TODAY), state.safe);
  const totalsToday = asOf === TODAY ? totals : publishedFloors(deriveFloors(property, TODAY, TODAY), state.safe);
  const floors = safeFloors(totals, state.safe);
  const kpis = safeKpis(computeKpis(property, totals, asOf), state.safe);
  const kpisToday = asOf === TODAY ? kpis : safeKpis(computeKpis(property, totalsToday, TODAY), state.safe);
  const issues = findIssues(property, totals, TODAY);
  const inquiry = state.inquiry && canShowInquiries(state.safe) ? property.inquiries.find((i) => i.id === state.inquiry) ?? null : null;
  const req = inquiry
    ? { size: inquiry.minSize, max: inquiry.maxSize, by: inquiry.neededBy, type: state.fit }
    : state.req
      ? { size: state.req, max: state.max, by: checkNeededBy(state.by, asOf).date, type: state.fit }
      : null;
  const fits = req ? searchSpace(floors, req, property.inquiries, asOf) : null;
  const worklist = (w: WindowKey): WorklistRow[] => worklistRows(floors, w);
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
    roll: safeRollover(rollover(totals, asOf, 'rolling', 8), state.safe),
    issues,
    counts: issueCounts(issues),
    changes: recentChanges(property, TODAY, 30),
    legend: legendFor(state.lens, state.safe, floors),
    req,
    fits,
    worklist,
    activeWorklist: state.window && canShowLeaseTerm(state.safe) ? worklist(state.window) : null,
    searchReasons: null,
    searchMatches: null,
    bucketKeys: null,
    highlight: fits?.keys ?? null,
    filterLabel: null,
    timeline: timelineModel(property, floors, asOf, TODAY, state.safe),
    selected,
    selectedFloor,
    anyEnlarged: false,
  };
}

function worklistRows(floors: FloorView[], window: WindowKey): WorklistRow[] {
  const rows: WorklistRow[] = [];
  for (const f of floors) {
    for (const s of f.segments) {
      if (!s.lease || !isLeaseKind(s.kind)) continue;
      const risk = s.kind === 'holdover' || s.kind === 'mtm';
      const months = s.kind === 'sublease' ? (s.headMonths ?? s.monthsToExpiry) : s.monthsToExpiry;
      const inWindow = window === 'risk' ? risk : !risk && months !== null && months <= (WINDOW_MONTHS[window] ?? 0);
      if (!inWindow) continue;
      rows.push({
        segKey: s.key,
        segKeys: [s.key],
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
