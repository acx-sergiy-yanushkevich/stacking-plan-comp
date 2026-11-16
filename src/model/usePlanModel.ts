import { useEffect, useMemo } from 'react';
import type { Deal, ISODate, Property, Touch } from '../domain/types';
import { canShowInquiries, canShowLeaseTerm, canShowTenantRisk, planDate, publishedFloors, safeFloors, safeKpis, safeRollover } from '../domain/safe';
import { deriveFloors, isLeaseKind, segmentIndex, activeDeals, type FloorView, type Segment } from '../domain/derive';
import { computeKpis, kpiDeltas, largestBlock, type Kpis } from '../domain/kpis';
import { rollover, bucketOf, type RolloverBucket } from '../domain/rollover';
import { legendFor, type LegendItem } from '../domain/lenses';
import { checkNeededBy, rangeProblem, searchSpace, type ChosenOption, type FinderResult, type FitType, type Requirement } from '../domain/finder';
import { readPlace, readQuery, sizeText, suiteNeedle, type QueryIntent } from '../domain/query';
import { setPinnedOption, usePinnedOption } from '../state/hoverStore';
import { findIssues, issueCounts, recentChanges, type Issue } from '../domain/issues';
import { timelineModel } from '../domain/timeline';
import type { PlanState, WindowKey } from '../state/planState';
import { num, sf } from '../domain/format';
import { daysBetween, fmtDate } from '../domain/dates';

export interface WorklistRow {
  /** The row's first suite: what selecting the row opens. */
  segKey: string;
  /** Every suite of the lease on this floor in the window: what the row highlights and exports. */
  segKeys: string[];
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
  /**
   * Active requirement (from state or the matched inquiry). A typed needed-by date earlier than the
   * as-of date is not part of it (`checkNeededBy`); the Find panel says so.
   */
  req: Requirement | null;
  /**
   * Finder results for `req` (`searchSpace`). `alternatives` are the near misses the Find panel lists
   * when exact options are few (smaller spaces, stacked floors), already narrowed to the requirement's
   * space type and maximum; `partial` is their suites, which the plan keeps readable instead of dimming;
   * `noFit` is the advice when there is no option at all.
   */
  fits: FinderResult | null;
  worklist: (window: WindowKey) => WorklistRow[];
  activeWorklist: WorklistRow[] | null;
  searchMatches: Set<string> | null;
  /**
   * A search query that is a space requirement ("12k direct by Jun 2027"): the requirement Find space should
   * run. The search box offers it (FilterBar) and Enter runs it (Toolbar); the text search finds nothing.
   */
  queryFind: Extract<QueryIntent, { kind: 'size' }> | null;
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
  /**
   * The label says nothing matched: the bar shows it as a sentence, not as a filter in force ("Showing … Other space is
   * dimmed"), and offers no way to the plan. A flag, not a test of the words (round 36: labels starting "There is" and
   * "Nothing" were read as filters because the bar looked for "No ").
   */
  filterEmpty: boolean;
  timeline: ReturnType<typeof timelineModel>;
  selected: Segment | null;
  selectedFloor: FloorView | null;
  anyEnlarged: boolean;
}

/** Day windows are counted in days; month windows use `months < n`, the same test as the Expiring KPI and the rollover's first buckets. */
export const WINDOW_DAYS: Partial<Record<WindowKey, number>> = { '90': 90, '180': 180 };
export const WINDOW_MONTHS: Partial<Record<WindowKey, number>> = { '12': 12, '24': 24 };
export const WINDOW_LABEL: Record<WindowKey, string> = { risk: 'At risk', '90': '90 days', '180': '180 days', '12': '12 months', '24': '24 months' };

/** The distinct leases a worklist lists (its rows are one per lease per floor). */
export const worklistLeaseCount = (rows: ReadonlyArray<WorklistRow>): number => new Set(rows.map((r) => r.seg.lease?.id ?? r.segKey)).size;

export function buildWorklist(floors: FloorView[], window: WindowKey, asOf: ISODate): WorklistRow[] {
  const rows: WorklistRow[] = [];
  const byId = new Map<string, WorklistRow>();
  for (const f of floors) {
    for (const s of f.segments) {
      if (!s.lease || !isLeaseKind(s.kind)) continue;
      // one row per lease per floor (multi-floor tenants appear once per floor they occupy)
      // A lease with several suites on one floor is one row with all of them: their SF summed, every key kept
      // (round 19: the second suite fell out of the total, the highlight and the CSV).
      const id = `${s.lease.id}:${f.floor.id}`;
      const risk = s.kind === 'holdover' || s.kind === 'mtm';
      const months = s.kind === 'sublease' ? (s.headMonths ?? s.monthsToExpiry) : s.monthsToExpiry;
      const days = WINDOW_DAYS[window];
      const within = days !== undefined ? !!s.endDate && daysBetween(asOf, s.endDate) <= days : months !== null && months < (WINDOW_MONTHS[window] ?? 0);
      const inWindow = window === 'risk' ? risk : !risk && within;
      if (!inWindow) continue;
      const known = byId.get(id);
      if (known) {
        known.size += s.size;
        known.segKeys.push(s.key);
        if (s.suite && !known.suite.split(', ').includes(s.suite)) known.suite = known.suite ? `${known.suite}, ${s.suite}` : s.suite;
        continue;
      }
      const row: WorklistRow = {
        segKey: s.key,
        segKeys: [s.key],
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
      };
      byId.set(id, row);
      rows.push(row);
    }
  }
  return rows.sort((a, b) => {
    const am = a.months ?? -1;
    const bm = b.months ?? -1;
    return am - bm || b.size - a.size;
  });
}

/** What a state search says when it finds nothing, in plain words (round 36: "No for sale space", "No signed, not yet in space"). */
const NONE_OF: Record<string, string> = {
  Available: 'No available space',
  Sublease: 'No sublease space',
  Holdover: 'No holdover',
  'Month-to-month': 'No month-to-month lease',
  'Holdover / month-to-month': 'No holdover or month-to-month lease',
  'For sale': 'Nothing for sale',
  'Signed, not yet in': 'No lease signed and not yet in',
};

/** Floors in words: "Floor 13", "Floors 13–14", "Floors 3, 5 and 9", "Floors 13–99". */
export function floorWords(ns: number[]): string {
  const xs = [...new Set(ns)].sort((a, b) => a - b);
  if (xs.length === 1) return `Floor ${xs[0]}`;
  const run = xs.every((n, i) => i === 0 || n === xs[i - 1] + 1);
  return run ? `Floors ${xs[0]}–${xs.at(-1)}` : `Floors ${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
}

/** Search hits with the reason each block matched ("Prospect: Vantage Robotics (LOI)"). */
export function search(floors: FloorView[], q: string, safe: boolean, intent: QueryIntent | null): Map<string, string> {
  const needle = suiteNeedle(q);
  const out = new Map<string, string>();
  if (!needle || intent?.kind === 'size' || intent?.kind === 'badDate' || intent?.kind === 'dateOnly') return out;
  // A state word lights that state ("sublease", "signed"), on one floor when the query names it ("subleases on
  // floor 7"); tenant risk ("holdover") says nothing to a prospect.
  if (intent?.kind === 'state') {
    if (intent.tenantRisk && !canShowTenantRisk(safe)) return out;
    for (const f of floors) {
      if (intent.floors !== null && !intent.floors.includes(f.floor.sequence)) continue;
      for (const s of f.segments) if (intent.kinds.has(s.kind) && !(intent.now && s.kind === 'available' && s.availableFrom)) out.set(s.key, intent.floors !== null ? `${intent.label} on ${f.floor.name}` : intent.label);
    }
    return out;
  }
  // "Largest block" lights the biggest space a tenant could take now (round 31: it found nothing).
  if (/^(?:the\s+)?(?:largest|biggest)(?:\s+(?:available|direct|vacant|contiguous))*(?:\s+(?:block|space|suite|vacancy))?$/.test(needle)) {
    // The KPI's own rule (domain/kpis.ts `largestBlock`), so the search, the KPI and the plan's tag cannot disagree.
    const lb = largestBlock(floors);
    for (const k of lb.keys) out.set(k, `Largest block, ${lb.size.toLocaleString('en-US')} SF on ${lb.floorName}`);
    return out;
  }
  // Floors and suites, read in the domain (`readPlace`): "floor 12", "floors 3-5", "unit 860", "860, 870", "Floor 8 Ste
  // 860", "1200-1250".
  const place = readPlace(q);
  if (place?.kind === 'floors') {
    for (const f of floors) if (place.floors.includes(f.floor.sequence)) for (const s of f.segments) out.set(s.key, f.floor.name);
    return out;
  }
  if (place?.kind === 'suites') {
    const all = floors.filter((f) => place.floor === null || f.floor.sequence === place.floor).flatMap((f) => f.segments);
    // Each number is a suite of that number, or the start of one when no suite has it whole ("unit 86" while typing).
    for (const want of place.suites) {
      const exact = all.filter((s) => s.suite?.toLowerCase() === want);
      for (const s of exact.length ? exact : all.filter((s) => s.suite?.toLowerCase().startsWith(want))) out.set(s.key, `Suite ${s.suite}`);
    }
    return out;
  }
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
  // Prospect-safe is always drawn as of today (domain/safe.ts, rule 4): the model does not rely on the
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

  // An inquiry is another prospect's requirement: in prospect-safe mode it is not read at all, so neither
  // its name nor its size and date can become the requirement on screen. (The state layer has already
  // dropped it; like the as-of date, the model does not rely on that.)
  const inquiry = state.inquiry && canShowInquiries(safe) ? property.inquiries.find((i) => i.id === state.inquiry) ?? null : null;
  const req = useMemo(() => {
    // An inquiry carries no space type (Inquiry has none), so the Direct / Sublease control applies to it too.
    if (inquiry) return { size: inquiry.minSize, max: inquiry.maxSize, by: inquiry.neededBy, type: state.fit as FitType };
    // A needed-by date before the as-of date (an old link, or the as-of date moved past it) is not applied.
    if (state.req) return { size: state.req, max: state.max, by: checkNeededBy(state.by, asOf).date, type: state.fit as FitType };
    return null;
  }, [inquiry, state.req, state.max, state.by, state.fit, asOf]);

  // A range whose maximum is below its minimum runs nothing: no option, no lit suite (the Find panel says why).
  const fits = useMemo(() => (req && !rangeProblem(req.size, req.max) ? searchSpace(floors, req, property.inquiries, asOf) : null), [floors, req, property.inquiries, asOf]);

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

  const intent = useMemo(() => readQuery(state.q, asOf), [state.q, asOf]);
  const queryFind = intent?.kind === 'size' ? intent : null;
  const searchReasons = useMemo(() => (state.q.trim() ? search(floors, state.q, safe, intent) : null), [floors, state.q, safe, intent]);
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
  let filterEmpty = false;
  if (fits && req) {
    // Every suite of the chosen option is lit, whether it is an exact match or an alternative.
    highlight = option ? new Set([...fits.keys, ...option.keys]) : fits.keys;
    filterLabel = `${inquiry ? `Space for ${inquiry.prospect}: ` : 'Space that fits '}${req.max ? sizeText(req.size, req.max) : `${num(req.size)}+`} SF${req.by ? ` by ${fmtDate(req.by)}` : ''} · ${fits.options.length} option${fits.options.length === 1 ? '' : 's'}`;
  } else if (queryFind) {
    // A size is a requirement, not a name: the bar offers Find space with it (FilterBar).
    highlight = null;
    filterLabel = `Find ${sizeText(queryFind.size, queryFind.max)} SF${queryFind.fit === 'any' ? '' : ` ${queryFind.fit}`}${queryFind.by ? ` by ${fmtDate(queryFind.by)}` : ''}`;
  } else if (searchMatches && searchMatches.size === 0) {
    highlight = null;
    // Prospect-safe search skips tenants and prospects, and never repeats the query: it may be a tenant name.
    // A state it understood says so in its own words (round 35: "available on floor 4" read as an unknown name). It
    // repeats only the state and the floor, never the query, so it is as safe for a prospect as the generic line.
    // A tenant-risk word in Prospect-safe keeps the generic line: "No holdover space" would tell a prospect something false.
    filterEmpty = true;
    const stateIntent = intent?.kind === 'state' && !(intent.tenantRisk && safe) ? intent : null;
    const named = stateIntent && stateIntent.floors !== null ? floors.filter((f) => stateIntent.floors!.includes(f.floor.sequence)) : [];
    // A floor the building does not have is said plainly (round 36: "No available space on Floor 99 now").
    // "floor 99" with no state word: the same plain line (round 36: it got the name-search message).
    // "floor 99" or "floors 30-35" with no state word: the same plain line (round 36: it got the name-search message).
    const place = readPlace(state.q);
    const placeFloors = stateIntent && stateIntent.floors !== null && !named.length ? stateIntent.floors : place?.kind === 'floors' ? place.floors : null;
    const missingFloor = placeFloors ? floorWords(placeFloors) : null;
    // A suite asked for on the wrong floor says where it is (round 38: "860 on floor 9" got the name-search line).
    const elsewhere = place?.kind === 'suites' && place.floor !== null ? floors.find((f) => f.segments.some((x) => place.suites.includes(x.suite?.toLowerCase() ?? ''))) : undefined;
    const span = `${Math.min(...floors.map((f) => f.floor.sequence))}–${Math.max(...floors.map((f) => f.floor.sequence))}`;
    filterLabel = intent?.kind === 'badDate'
      ? `${intent.badBy} is not a date on the calendar.`
      : intent?.kind === 'dateOnly'
      ? `${fmtDate(intent.by)} is a date: add a size to find space by then (“12,000 SF by ${fmtDate(intent.by)}”).`
      : elsewhere && place?.kind === 'suites'
      ? `Suite ${place.suites.join(', ')} is on ${elsewhere.floor.name}, not Floor ${place.floor}.`
      : missingFloor !== null
      ? `${placeFloors && placeFloors.length > 1 ? `There are no ${missingFloor}` : `There is no ${missingFloor}`} here (Floors ${span}).`
      : stateIntent
      ? `${NONE_OF[stateIntent.label] ?? `No ${stateIntent.label.toLowerCase()} space`}${stateIntent.floors !== null ? ` on ${floorWords(stateIntent.floors)}` : ''}${stateIntent.now ? ' now' : ''}.`
      : safe
      ? 'No suite or floor matches. Try a suite number (“350”), a floor (“Floor 8”) or a size (“12,000 SF”).'
      : `No tenant, suite or prospect matches “${state.q}”. Try a suite number (“350”), a floor (“Floor 8”) or a size (“12,000 SF”).`;
  } else if (searchMatches) {
    highlight = searchMatches;
    const reasons = searchReasons ? [...searchReasons.entries()] : [];
    const onFloor = reasons.length === 1 ? (floors.find((f) => f.segments.some((s) => s.key === reasons[0][0]))?.floor.name ?? '') : '';
    // A reason that already names the floor says it once (round 31: "Floor 6 on Floor 6 Ste 600").
    const detail = reasons.length === 1 ? `: ${reasons[0][1] === 'Tenant' ? (segIndex.get(reasons[0][0])?.lease?.tenant ?? 'tenant name') : reasons[0][1]}${reasons[0][1].includes(onFloor) ? '' : ` on ${onFloor}`}${segIndex.get(reasons[0][0])?.suite && !reasons[0][1].includes(segIndex.get(reasons[0][0])!.suite!) ? ` Ste ${segIndex.get(reasons[0][0])!.suite}` : ''}` : '';
    // What a place search asked for and the building lacks is named beside what it found (round 38: "860, 870" said
    // "1 match: Suite 860", and "floors 11-14" lit 11 and 12 without a word about 13 and 14).
    const place = readPlace(state.q);
    const stateFloors = intent?.kind === 'state' ? intent.floors : null;
    const askedFloors = place?.kind === 'floors' ? place.floors : stateFloors;
    const noFloors = askedFloors ? askedFloors.filter((n) => !floors.some((f) => f.floor.sequence === n)) : [];
    const allSuites = floors.flatMap((f) => f.segments).map((x) => x.suite?.toLowerCase()).filter((x): x is string => !!x);
    const noSuites = place?.kind === 'suites' ? place.suites.filter((w) => !allSuites.some((x) => x === w || x.startsWith(w))) : [];
    const missing = [noFloors.length ? `no ${floorWords(noFloors)} here` : '', noSuites.length ? `no Suite ${noSuites.join(', ')} here` : ''].filter(Boolean).join(' · ');
    filterLabel = `${safe ? 'Search' : `Search “${state.q}”`} · ${searchMatches.size} match${searchMatches.size === 1 ? '' : 'es'}${detail}${missing ? ` · ${missing}` : ''}`;
  } else if (activeWorklist && effectiveWindow) {
    highlight = new Set(activeWorklist.flatMap((r) => r.segKeys));
    const total = activeWorklist.reduce((s, r) => s + r.size, 0);
    // Leases, not rows: a tenant on two floors is two rows and one lease.
    const leases = worklistLeaseCount(activeWorklist);
    filterLabel = `${effectiveWindow === 'risk' ? 'Leases at risk (holdover,\u00a0month-to-month)' : `Leases ending within ${WINDOW_LABEL[effectiveWindow]}`} · ${leases}\u00a0lease${leases === 1 ? '' : 's'} · ${sf(total).replace(' ', '\u00a0')}`;
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
    queryFind,
    searchReasons,
    bucketKeys,
    highlight,
    partial: fits && req ? fits.partial : null,
    option,
    filterLabel,
    filterEmpty,
    timeline,
    selected,
    selectedFloor,
    anyEnlarged: false,
  };
}
