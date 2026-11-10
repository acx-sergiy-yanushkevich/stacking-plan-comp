import { useEffect, useMemo } from 'react';
import type { Deal, ISODate, Property, Touch } from '../domain/types';
import { canShowLeaseTerm, planDate, publishedFloors, safeFloors, safeKpis, safeRollover } from '../domain/safe';
import { deriveFloors, isLeaseKind, segmentIndex, activeDeals, type FloorView, type Segment } from '../domain/derive';
import { computeKpis, kpiDeltas, type Kpis } from '../domain/kpis';
import { rollover, bucketOf, type RolloverBucket } from '../domain/rollover';
import { legendFor, type LegendItem } from '../domain/lenses';
import { findFits, filterFits, nearMisses, type ChosenOption, type FitOption, type FitType, type NearMiss } from '../domain/finder';
import { setPinnedOption, usePinnedOption } from '../state/hoverStore';
import { findIssues, issueCounts, recentChanges, type Issue } from '../domain/issues';
import { timelineModel } from '../domain/timeline';
import type { PlanState, WindowKey } from '../state/planState';
import { num, sf } from '../domain/format';
import { daysBetween, fmtDate } from '../domain/dates';

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
  /**
   * Finder results for `req`. `alternatives` are the near misses the Find panel lists when exact options
   * are few (smaller spaces, stacked floors), already narrowed to the requirement's space type; `partial`
   * is their suites, which the plan keeps readable instead of dimming.
   */
  fits: { options: FitOption[]; keys: Set<string>; alternatives: NearMiss[]; partial: Set<string>; largestNow: { size: number; floorName: string } } | null;
  worklist: (window: WindowKey) => WorklistRow[];
  activeWorklist: WorklistRow[] | null;
  searchMatches: Set<string> | null;
  /** Why each search hit matched, by segment key. */
  searchReasons: Map<string, string> | null;
  bucketKeys: Set<string> | null;
  /** Union of the active filter; null when nothing is filtered. */
  highlight: Set<string> | null;
  /** Finder alternatives: not matches, but kept readable instead of dimmed. */
  partial?: Set<string> | null;
  /**
   * The finder row the user clicked, while the finder is on and the selected suite is one of its
   * suites: all of them are in `highlight`, and the inspector lists them.
   */
  option?: ChosenOption | null;
  filterLabel: string | null;
  timeline: ReturnType<typeof timelineModel>;
  selected: Segment | null;
  selectedFloor: FloorView | null;
  anyEnlarged: boolean;
}

/** Day windows are counted in days; month windows use `months < n`, the same test as the Expiring KPI and the rollover's first buckets. */
export const WINDOW_DAYS: Partial<Record<WindowKey, number>> = { '90': 90, '180': 180 };
export const WINDOW_MONTHS: Partial<Record<WindowKey, number>> = { '12': 12, '24': 24 };
export const WINDOW_LABEL: Record<WindowKey, string> = { risk: 'At risk', '90': '90 days', '180': '180 days', '12': '12 months', '24': '24 months' };

function buildWorklist(floors: FloorView[], window: WindowKey, asOf: ISODate): WorklistRow[] {
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
      const days = WINDOW_DAYS[window];
      const within = days !== undefined ? !!s.endDate && daysBetween(asOf, s.endDate) <= days : months !== null && months < (WINDOW_MONTHS[window] ?? 0);
      const inWindow = window === 'risk' ? risk : !risk && within;
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
  const { safe, lens } = state;
  // Prospect-safe is always drawn as of today (domain/safe.ts, rule 3): the model does not rely on the
  // state layer having already dropped the date.
  const asOf = planDate(state.asOf, today, safe);
  // Two projections, one policy (domain/safe.ts). `totals` keeps the real lease terms and feeds only
  // building-wide figures (KPIs, issue detection), which name no suite. `floors` is what every view draws
  // and lists: in prospect-safe mode it carries no quiet listing and no lease date, so no block, bar, row,
  // finder option or label built from it can show either.
  const totals = useMemo(() => publishedFloors(deriveFloors(property, asOf, today), safe), [property, asOf, today, safe]);
  const totalsToday = useMemo(() => (asOf === today ? totals : publishedFloors(deriveFloors(property, today, today), safe)), [property, totals, asOf, today, safe]);
  const floors = useMemo(() => safeFloors(totals, safe), [totals, safe]);
  const segIndex = useMemo(() => segmentIndex(floors), [floors]);
  const kpis = useMemo(() => safeKpis(computeKpis(property, totals, asOf), safe), [property, totals, asOf, safe]);
  const kpisToday = useMemo(() => (asOf === today ? kpis : safeKpis(computeKpis(property, totalsToday, today), safe)), [property, totalsToday, kpis, asOf, today, safe]);
  const deltas = useMemo(() => (asOf === today ? null : kpiDeltas(kpis, kpisToday)), [kpis, kpisToday, asOf, today]);
  // The rollover by period is withheld from a prospect: `safeRollover` leaves no period to draw.
  const roll = useMemo(() => safeRollover(rollover(totals, asOf, 'rolling', 8), safe), [totals, asOf, safe]);
  const issues = useMemo(() => findIssues(property, totals, today), [property, totals, today]);
  const counts = useMemo(() => issueCounts(issues), [issues]);
  const changes = useMemo(() => recentChanges(property, today, 30), [property, today]);
  const legend = useMemo(() => legendFor(lens, safe, floors), [lens, safe, floors]);
  const timeline = useMemo(() => timelineModel(property, floors, asOf, today, safe), [property, floors, asOf, today, safe]);

  const inquiry = state.inquiry ? property.inquiries.find((i) => i.id === state.inquiry) ?? null : null;
  const req = useMemo(() => {
    // An inquiry carries no space type (Inquiry has none), so the Direct / Sublease control applies to it too.
    if (inquiry) return { size: inquiry.minSize, max: inquiry.maxSize, by: inquiry.neededBy, type: state.fit as FitType };
    if (state.req) return { size: state.req, max: state.max, by: state.by, type: state.fit as FitType };
    return null;
  }, [inquiry, state.req, state.max, state.by, state.fit]);

  const fits = useMemo(() => {
    if (!req) return null;
    const r = findFits(floors, req.size, req.by, req.max, property.inquiries, asOf);
    const options = filterFits(r.options, req.type);
    const keys = new Set(options.flatMap((o) => o.keys));
    // Alternatives (smaller spaces and stacked floors) when exact options are few, held to the same space type.
    const alternatives = options.length < 3 ? nearMisses(floors, req.size, asOf, req.type) : [];
    return { options, keys, alternatives, partial: new Set(alternatives.flatMap((m) => m.keys).filter((k) => !keys.has(k))), largestNow: r.largestNow };
  }, [floors, req, property.inquiries, asOf]);

  const worklist = useMemo(() => {
    const cache = new Map<WindowKey, WorklistRow[]>();
    return (w: WindowKey) => {
      let rows = cache.get(w);
      if (!rows) {
        rows = buildWorklist(floors, w, asOf);
        cache.set(w, rows);
      }
      return rows;
    };
  }, [floors, asOf]);
  // Prospect-safe has no worklist and no expiry highlight: both point at single leases by their term.
  const effectiveWindow: WindowKey | null = canShowLeaseTerm(safe) ? state.window : null;
  const activeWorklist = effectiveWindow ? worklist(effectiveWindow) : null;

  const searchReasons = useMemo(() => (state.q ? search(floors, state.q, safe) : null), [floors, state.q, safe]);
  const searchMatches = useMemo(() => (searchReasons ? new Set(searchReasons.keys()) : null), [searchReasons]);

  const bucketKeys = useMemo(() => {
    const tail = roll.buckets.at(-1)?.key;
    if (state.bucket === null || !canShowLeaseTerm(safe) || tail === undefined) return null;
    const out = new Set<string>();
    for (const f of floors) for (const s of f.segments) if (s.lease && bucketOf(s, 'rolling', tail) === state.bucket) out.add(s.key);
    return out;
  }, [floors, roll, state.bucket, safe]);

  // A clicked finder row is kept while the finder is on and the selection stays inside it; it is
  // forgotten when the finder clears, so it cannot come back with a later requirement.
  const pinnedOption = usePinnedOption();
  const finding = fits !== null;
  useEffect(() => {
    if (!finding) setPinnedOption(null);
  }, [finding]);
  const option = fits && pinnedOption && state.select !== null && pinnedOption.keys.includes(state.select) ? pinnedOption : null;

  let highlight: Set<string> | null = null;
  let filterLabel: string | null = null;
  if (fits && req) {
    // Every suite of the chosen option is lit, whether it is an exact match or an alternative.
    highlight = option ? new Set([...fits.keys, ...option.keys]) : fits.keys;
    const who = inquiry ? (safe ? 'an open inquiry' : inquiry.prospect) : null;
    filterLabel = `${who ? `Space for ${who}: ` : 'Space that fits '}${num(req.size)}${req.max ? `–${num(req.max)}` : '+'} SF${req.by ? ` by ${fmtDate(req.by)}` : ''} · ${fits.options.length} option${fits.options.length === 1 ? '' : 's'}`;
  } else if (searchMatches && searchMatches.size === 0) {
    highlight = null;
    // Prospect-safe search skips tenants and prospects, and never repeats the query: it may be a tenant name.
    filterLabel = safe
      ? 'No suite or floor matches. Try a suite number (“350”) or a floor (“Floor 8”).'
      : `No tenant, suite or prospect matches “${state.q}”. Try a suite number (“350”) or a floor (“Floor 8”).`;
  } else if (searchMatches) {
    highlight = searchMatches;
    const reasons = searchReasons ? [...searchReasons.entries()] : [];
    const detail = reasons.length === 1 ? `: ${reasons[0][1] === 'Tenant' ? 'tenant name' : reasons[0][1]} on ${floors.find((f) => f.segments.some((s) => s.key === reasons[0][0]))?.floor.name ?? ''}${segIndex.get(reasons[0][0])?.suite ? ` Ste ${segIndex.get(reasons[0][0])!.suite}` : ''}` : '';
    filterLabel = `${safe ? 'Search' : `Search “${state.q}”`} · ${searchMatches.size} match${searchMatches.size === 1 ? '' : 'es'}${detail}`;
  } else if (activeWorklist && effectiveWindow) {
    highlight = new Set(activeWorklist.map((r) => r.segKey));
    const total = activeWorklist.reduce((s, r) => s + r.size, 0);
    filterLabel = `${effectiveWindow === 'risk' ? 'Leases at risk (holdover, month-to-month)' : `Leases ending within ${WINDOW_LABEL[effectiveWindow]}`} · ${activeWorklist.length}\u00a0lease${activeWorklist.length === 1 ? '' : 's'} · ${sf(total).replace(' ', '\u00a0')}`;
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
    partial: fits && req ? fits.partial : null,
    option,
    filterLabel,
    timeline,
    selected,
    selectedFloor,
    anyEnlarged: false,
  };
}
