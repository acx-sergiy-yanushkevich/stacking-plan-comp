import { useMemo } from 'react';
import type { Deal, ISODate, Property, Touch } from '../domain/types';
import { deriveFloors, isLeaseKind, segmentIndex, activeDeals, type FloorView, type Segment } from '../domain/derive';
import { computeKpis, kpiDeltas, type Kpis } from '../domain/kpis';
import { rollover, bucketOf, type RolloverBucket } from '../domain/rollover';
import { legendFor, type LegendItem } from '../domain/lenses';
import { findFits, filterFits, type FitOption, type FitType } from '../domain/finder';
import { findIssues, issueCounts, recentChanges, type Issue } from '../domain/issues';
import { timelineModel } from '../domain/timeline';
import type { PlanState, WindowKey } from '../state/planState';
import { num, sf } from '../domain/format';
import { fmtDate } from '../domain/dates';

export interface WorklistRow {
  segKey: string;
  floorId: string;
  floorName: string;
  suite: string;
  tenant: string;
  size: number;
  /** Months to lease end from as-of; null for MTM. */
  months: number | null;
  endDate: ISODate | null;
  kind: Segment['kind'];
  broker?: string;
  lastTouch?: Touch;
  renewal: Deal | null;
  seg: Segment;
}

export interface PlanModel {
  property: Property;
  today: ISODate;
  asOf: ISODate;
  safe: boolean;
  isProjected: boolean;
  floors: FloorView[];
  segIndex: Map<string, Segment>;
  kpis: Kpis;
  kpisToday: Kpis;
  deltas: ReturnType<typeof kpiDeltas> | null;
  roll: ReturnType<typeof rollover>;
  issues: Issue[];
  counts: ReturnType<typeof issueCounts>;
  changes: ReturnType<typeof recentChanges>;
  legend: LegendItem[];
  /** Active requirement (from state or the matched inquiry). */
  req: { size: number; max: number | null; by: ISODate | null; type: FitType } | null;
  fits: { options: FitOption[]; keys: Set<string>; largestNow: { size: number; floorName: string } } | null;
  worklist: (window: WindowKey) => WorklistRow[];
  activeWorklist: WorklistRow[] | null;
  searchMatches: Set<string> | null;
  /** Why each search hit matched, by segment key. */
  searchReasons: Map<string, string> | null;
  bucketKeys: Set<string> | null;
  /** Union of the active filter; null when nothing is filtered. */
  highlight: Set<string> | null;
  filterLabel: string | null;
  timeline: ReturnType<typeof timelineModel>;
  selected: Segment | null;
  selectedFloor: FloorView | null;
  anyEnlarged: boolean;
}

export const WINDOW_MONTHS: Record<Exclude<WindowKey, 'risk'>, number> = { '90': 3, '180': 6, '12': 12, '24': 24 };
export const WINDOW_LABEL: Record<WindowKey, string> = { risk: 'At risk', '90': '90 days', '180': '180 days', '12': '12 months', '24': '24 months' };

function buildWorklist(floors: FloorView[], window: WindowKey): WorklistRow[] {
  const rows: WorklistRow[] = [];
  const seen = new Set<string>();
  for (const f of floors) {
    for (const s of f.segments) {
      if (!s.lease || !isLeaseKind(s.kind)) continue;
      // one row per lease per floor (multi-floor tenants appear once per floor they occupy)
      const id = `${s.lease.id}:${f.floor.id}`;
      if (seen.has(id)) continue;
      const risk = s.kind === 'holdover' || s.kind === 'mtm';
      const months = s.kind === 'sublease' ? (s.headMonths ?? s.monthsToExpiry) : s.monthsToExpiry;
      const inWindow = window === 'risk' ? risk : !risk && months !== null && months <= WINDOW_MONTHS[window];
      if (!inWindow) continue;
      seen.add(id);
      rows.push({
        segKey: s.key,
        floorId: f.floor.id,
        floorName: f.floor.name,
        suite: s.suite ?? '',
        tenant: s.lease.tenant,
        size: s.size,
        months: risk && s.kind === 'mtm' ? null : months,
        endDate: s.endDate,
        kind: s.kind,
        broker: s.lease.owner,
        lastTouch: s.lease.lastTouch,
        renewal: activeDeals(s.lease.deals).find((d) => d.kind === 'Renewal') ?? null,
        seg: s,
      });
    }
  }
  return rows.sort((a, b) => {
    const am = a.months ?? -1;
    const bm = b.months ?? -1;
    return am - bm || b.size - a.size;
  });
}

/** Search hits with the reason each block matched ("Prospect: Vantage Robotics (LOI)"). */
function search(floors: FloorView[], q: string, safe: boolean): Map<string, string> {
  const needle = q.trim().toLowerCase();
  const out = new Map<string, string>();
  if (!needle) return out;
  const hit = (v: string | undefined) => !!v && v.toLowerCase().includes(needle);
  for (const f of floors) {
    for (const s of f.segments) {
      let reason: string | null = null;
      if (s.suite && (hit(s.suite) || hit(`ste ${s.suite}`) || hit(`suite ${s.suite}`))) reason = `Suite ${s.suite}`;
      else if (hit(f.floor.name)) reason = f.floor.name;
      else if (!safe) {
        const deals = [...(s.availability?.deals ?? []), ...(s.marketed?.deals ?? []), ...(s.lease?.deals ?? [])];
        const deal = deals.find((d) => hit(d.prospect));
        const broker = deals.find((d) => hit(d.broker));
        if (s.lease && hit(s.lease.tenant)) reason = 'Tenant';
        else if (s.lease && hit(s.lease.tenantContact)) reason = `Contact: ${s.lease.tenantContact}`;
        else if (s.lease && hit(s.lease.owner)) reason = `Broker: ${s.lease.owner}`;
        else if (s.lease && hit(s.lease.industry)) reason = `Industry: ${s.lease.industry}`;
        else if (deal) reason = `Prospect: ${deal.prospect} (${deal.stage})`;
        else if (broker) reason = `Deal broker: ${broker.broker}`;
        else if (s.suspect && hit(s.suspect.tenant)) reason = `Likely ${s.suspect.tenant}`;
      }
      if (reason) out.set(s.key, reason);
    }
  }
  return out;
}

export function usePlanModel(property: Property, state: PlanState, today: ISODate): PlanModel {
  const { asOf, safe, lens } = state;
  const floors = useMemo(() => deriveFloors(property, asOf, today), [property, asOf, today]);
  const floorsToday = useMemo(() => (asOf === today ? floors : deriveFloors(property, today, today)), [property, floors, asOf, today]);
  const segIndex = useMemo(() => segmentIndex(floors), [floors]);
  const kpis = useMemo(() => computeKpis(property, floors, asOf), [property, floors, asOf]);
  const kpisToday = useMemo(() => (asOf === today ? kpis : computeKpis(property, floorsToday, today)), [property, floorsToday, kpis, asOf, today]);
  const deltas = useMemo(() => (asOf === today ? null : kpiDeltas(kpis, kpisToday)), [kpis, kpisToday, asOf, today]);
  const roll = useMemo(() => rollover(floors, asOf, 'rolling', 8), [floors, asOf]);
  const issues = useMemo(() => findIssues(property, floors, today), [property, floors, today]);
  const counts = useMemo(() => issueCounts(issues), [issues]);
  const changes = useMemo(() => recentChanges(property, today, 30), [property, today]);
  const legend = useMemo(() => legendFor(lens, safe, floors), [lens, safe, floors]);
  const timeline = useMemo(() => timelineModel(property, floors, asOf, today), [property, floors, asOf, today]);

  const inquiry = state.inquiry ? property.inquiries.find((i) => i.id === state.inquiry) ?? null : null;
  const req = useMemo(() => {
    if (inquiry) return { size: inquiry.minSize, max: inquiry.maxSize, by: inquiry.neededBy, type: 'any' as FitType };
    if (state.req) return { size: state.req, max: state.max, by: state.by, type: state.fit as FitType };
    return null;
  }, [inquiry, state.req, state.max, state.by, state.fit]);

  const fits = useMemo(() => {
    if (!req) return null;
    const r = findFits(floors, req.size, req.by, req.max, property.inquiries, asOf);
    const options = filterFits(r.options, req.type);
    return { options, keys: new Set(options.flatMap((o) => o.keys)), largestNow: r.largestNow };
  }, [floors, req, property.inquiries, asOf]);

  const worklist = useMemo(() => {
    const cache = new Map<WindowKey, WorklistRow[]>();
    return (w: WindowKey) => {
      let rows = cache.get(w);
      if (!rows) {
        rows = buildWorklist(floors, w);
        cache.set(w, rows);
      }
      return rows;
    };
  }, [floors]);
  const effectiveWindow: WindowKey | null = state.window === 'risk' && safe ? '12' : state.window;
  const activeWorklist = effectiveWindow ? worklist(effectiveWindow) : null;

  const searchReasons = useMemo(() => (state.q ? search(floors, state.q, safe) : null), [floors, state.q, safe]);
  const searchMatches = useMemo(() => (searchReasons ? new Set(searchReasons.keys()) : null), [searchReasons]);

  const bucketKeys = useMemo(() => {
    if (state.bucket === null) return null;
    const tail = roll.buckets[roll.buckets.length - 1].key;
    const out = new Set<string>();
    for (const f of floors) for (const s of f.segments) if (s.lease && bucketOf(s, 'rolling', tail) === state.bucket) out.add(s.key);
    return out;
  }, [floors, roll, state.bucket]);

  let highlight: Set<string> | null = null;
  let filterLabel: string | null = null;
  if (fits && req) {
    highlight = fits.keys;
    const who = inquiry ? (safe ? 'an open inquiry' : inquiry.prospect) : null;
    filterLabel = `${who ? `Space for ${who}: ` : 'Space that fits '}${num(req.size)}${req.max ? `–${num(req.max)}` : '+'} SF${req.by ? ` by ${fmtDate(req.by)}` : ''} · ${fits.options.length} option${fits.options.length === 1 ? '' : 's'}`;
  } else if (searchMatches) {
    highlight = searchMatches;
    const reasons = searchReasons ? [...searchReasons.entries()] : [];
    const detail = reasons.length === 1 ? `: ${reasons[0][1] === 'Tenant' ? 'tenant name' : reasons[0][1]} on ${floors.find((f) => f.segments.some((s) => s.key === reasons[0][0]))?.floor.name ?? ''}${segIndex.get(reasons[0][0])?.suite ? ` Ste ${segIndex.get(reasons[0][0])!.suite}` : ''}` : '';
    filterLabel = `Search “${state.q}” · ${searchMatches.size} match${searchMatches.size === 1 ? '' : 'es'}${detail}`;
  } else if (activeWorklist && effectiveWindow) {
    highlight = new Set(activeWorklist.map((r) => r.segKey));
    const total = activeWorklist.reduce((s, r) => s + r.size, 0);
    filterLabel = `${WINDOW_LABEL[effectiveWindow]} renewal worklist · ${activeWorklist.length} lease${activeWorklist.length === 1 ? '' : 's'} · ${sf(total)}`;
  } else if (bucketKeys && state.bucket !== null) {
    highlight = bucketKeys;
    const b: RolloverBucket | undefined = roll.buckets.find((x) => x.key === state.bucket);
    filterLabel = b ? `Leases ending ${b.label} · ${sf(b.sf)}` : null;
  }

  const selected = state.select ? segIndex.get(state.select) ?? null : null;
  const selectedFloor = state.floor ? floors.find((f) => f.floor.id === state.floor) ?? null : selected ? floors.find((f) => f.floor.id === selected.floorId) ?? null : null;

  return {
    property,
    today,
    asOf,
    safe,
    isProjected: asOf !== today,
    floors,
    segIndex,
    kpis,
    kpisToday,
    deltas,
    roll,
    issues,
    counts,
    changes,
    legend,
    req,
    fits,
    worklist,
    activeWorklist,
    searchMatches,
    searchReasons,
    bucketKeys,
    highlight,
    filterLabel,
    timeline,
    selected,
    selectedFloor,
    anyEnlarged: false,
  };
}
