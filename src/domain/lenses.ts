import type { DealStage } from './types';
import { type FloorView, type Segment } from './derive';
import { annualRate } from './format';
import { canShowDeals, canShowIssues, canShowLeaseTerm, canShowTenantRisk, termHidden } from './safe';

export type LensId = 'status' | 'expiry' | 'deals' | 'rent';

/**
 * The colour lenses. Each label is the one name the lens goes by everywhere: the toolbar's option, the
 * legend's title, and (for Pipeline) the KPI that switches to it.
 */
export const LENSES: Array<{ id: LensId; label: string; hint: string }> = [
  { id: 'status', label: 'Occupancy', hint: 'Leased, available, committed and at-risk space' },
  { id: 'expiry', label: 'Expiration', hint: 'Months from the as-of date to lease expiration' },
  { id: 'deals', label: 'Pipeline', hint: 'Most advanced deal on each space' },
  { id: 'rent', label: 'Rent', hint: 'In-place or asking rent, $/SF/yr — full-service gross; NNN and MG shown separately' },
];

/**
 * A tone is the `<name>` of a `--tone-<name>-fill` token in `src/styles/tokens.css`.
 * Colour is never the only cue: kinds also carry patterns, borders and text labels.
 */
export type Tone =
  | 'leased'
  | 'expiring'
  | 'risk'
  | 'available'
  | 'available-later'
  | 'sublease'
  | 'committed'
  | 'forsale'
  | 'empty'
  | 'projected'
  | 'muted'
  | 'neutral'
  | 'confidential'
  | 'exp-0' | 'exp-1' | 'exp-2' | 'exp-3' | 'exp-4' | 'exp-5'
  | 'rent-0' | 'rent-1' | 'rent-2' | 'rent-3' | 'rent-4'
  | 'rent-net'
  | 'deal-0' | 'deal-1' | 'deal-2' | 'deal-3'
  | 'deal-none';

export type LegendPattern = 'hatch' | 'dots' | 'dashed' | 'topbar' | 'asking';

export interface LegendItem {
  tone: Tone;
  label: string;
  pattern?: LegendPattern;
  /** Segment SF carrying this tone across the floors passed to `legendFor`. */
  sf: number;
  /** `sf` as a fraction of total leasable SF (0..1). */
  share: number;
  /**
   * A pattern drawn over other items' space (the rent lens's "Asking rent"): its SF and share are
   * real, and the same space is also counted under the band it sits in.
   */
  overlay?: boolean;
}

const STAGE_ORDER: DealStage[] = ['Tour', 'Proposal', 'LOI', 'Lease Out'];
export const stageRank = (s: DealStage) => STAGE_ORDER.indexOf(s);

/** A lease's deals count on its suite while the lease is in place or committed — not once it has ended. */
const leaseDeals = (seg: Segment) =>
  seg.kind === 'leased' || seg.kind === 'holdover' || seg.kind === 'mtm' || seg.kind === 'sublease' || seg.kind === 'committed'
    ? (seg.lease?.deals ?? [])
    : [];

/** Most advanced deal on the space. A "Lease Out" only counts on the committed lease it produced. */
export function topDeal(seg: Segment) {
  const deals = [
    ...(seg.availability?.deals ?? []),
    ...(seg.marketed?.deals ?? []),
    ...(seg.origin?.deals ?? []),
    ...leaseDeals(seg),
  ].filter((d) => d.stage !== 'Lease Out' || seg.kind === 'committed');
  if (deals.length === 0) return null;
  return deals.reduce((a, b) => (stageRank(b.stage) > stageRank(a.stage) ? b : a));
}

/** Open (not yet signed) deals on the space. */
export function dealCount(seg: Segment) {
  return [...(seg.availability?.deals ?? []), ...(seg.marketed?.deals ?? []), ...leaseDeals(seg)].filter(
    (d) => d.stage !== 'Lease Out',
  ).length;
}

const VACANT_KINDS = new Set<Segment['kind']>(['available', 'sublease', 'committed', 'projected', 'unmarketed']);
export const isVacantKind = (seg: Segment) => VACANT_KINDS.has(seg.kind);

/** exp-0 is the soonest bucket (< 6 months); exp-5 is 5+ years. */
function expiryTone(m: number | null): Tone {
  if (m === null) return 'neutral';
  if (m < 6) return 'exp-0';
  if (m < 12) return 'exp-1';
  if (m < 24) return 'exp-2';
  if (m < 36) return 'exp-3';
  if (m < 60) return 'exp-4';
  return 'exp-5';
}

/** Annual $/SF: asking midpoint on vacancies, in-place rate on leases; null when unknown. */
export function rentValue(seg: Segment): number | null {
  if (seg.availability && (seg.kind === 'available' || seg.kind === 'sublease')) {
    const a = seg.availability;
    return annualRate((a.rentLow + a.rentHigh) / 2, a.rateUnit);
  }
  if (seg.lease && seg.lease.rate !== null && seg.kind !== 'projected') {
    return annualRate(seg.lease.rate, seg.lease.rateUnit);
  }
  return null;
}

export function rentType(seg: Segment) {
  if (seg.availability && (seg.kind === 'available' || seg.kind === 'sublease')) return seg.availability.leaseType;
  return seg.lease?.leaseType;
}

function rentTone(v: number | null, type: string | undefined): Tone {
  if (v === null) return 'muted';
  // Net and modified-gross rents exclude operating costs: never rank them on the gross scale.
  if (type && type !== 'FSG') return 'rent-net';
  if (v < 28) return 'rent-0';
  if (v < 31) return 'rent-1';
  if (v < 34) return 'rent-2';
  if (v < 38) return 'rent-3';
  return 'rent-4';
}

function statusTone(seg: Segment, prospectSafe: boolean): Tone {
  switch (seg.kind) {
    case 'available':
      return seg.availableFrom ? 'available-later' : 'available';
    case 'sublease':
      return 'sublease';
    case 'committed':
      return 'committed';
    case 'forsale':
      return 'forsale';
    case 'projected':
      return 'projected';
    case 'unmarketed':
      // An unaccounted area is a data gap; a prospect sees space that is simply not on offer.
      return canShowIssues(prospectSafe) ? 'empty' : 'muted';
    case 'holdover':
    case 'mtm':
      // Prospects never see tenant risk; the suite is simply leased.
      return canShowTenantRisk(prospectSafe) ? 'risk' : 'leased';
    case 'leased':
      // An occupied suite marketed for later stays leased; the "Avail later" badge carries the date.
      if (prospectSafe) return 'leased';
      return seg.monthsToExpiry !== null && seg.monthsToExpiry < 12 ? 'expiring' : 'leased';
  }
}

export function toneFor(seg: Segment, lens: LensId, prospectSafe: boolean): Tone {
  switch (lens) {
    case 'status':
      return statusTone(seg, prospectSafe);
    case 'expiry':
      if (seg.kind === 'forsale') return 'muted';
      // Prospect-safe: no lease in place shows its term, so the ramp is not used at all. Every lease
      // (ordinary, holdover, month-to-month) is one "Leased" tone and a sublet suite keeps its dots.
      if (termHidden(seg.kind, prospectSafe)) return seg.kind === 'sublease' ? 'sublease' : 'leased';
      if (seg.kind === 'holdover' || seg.kind === 'mtm') return 'risk';
      if (seg.kind === 'leased' || seg.kind === 'sublease') return expiryTone(seg.monthsToExpiry);
      if (seg.kind === 'committed') return 'committed';
      if (seg.kind === 'projected') return 'projected';
      return 'empty';
    case 'deals': {
      if (seg.kind === 'forsale') return 'forsale';
      if (!canShowDeals(prospectSafe)) return seg.kind === 'available' || seg.kind === 'sublease' ? 'empty' : 'muted';
      const d = topDeal(seg);
      if (d) return `deal-${stageRank(d.stage)}` as Tone;
      return isVacantKind(seg) && seg.kind !== 'committed' ? 'deal-none' : 'muted';
    }
    case 'rent':
      if (seg.kind === 'forsale') return 'forsale';
      // Prospect-safe: every lease's rent (in place or committed) is withheld the same way, so a
      // confidential lease does not stand out.
      if (prospectSafe && (!isVacantKind(seg) || seg.kind === 'committed')) return 'muted';
      // Confidential wins over everything that carries the lease (in place or committed).
      if (seg.lease?.confidential && (!isVacantKind(seg) || seg.kind === 'committed')) return 'confidential';
      return rentTone(rentValue(seg), rentType(seg));
  }
}

type LegendSpec = Omit<LegendItem, 'sf' | 'share'>;

function legendSpecs(lens: LensId, prospectSafe: boolean): LegendSpec[] {
  if (lens === 'status' && prospectSafe)
    return [
      { tone: 'available', label: 'Available (direct)' },
      { tone: 'sublease', label: 'Sublease', pattern: 'dots' },
      { tone: 'committed', label: 'Signed, not yet in', pattern: 'hatch' },
      { tone: 'available-later', label: 'Available later', pattern: 'dashed' },
      { tone: 'projected', label: 'Projected vacancy', pattern: 'dashed' },
      { tone: 'forsale', label: 'For sale' },
      // The space tenants are in (80.2%): the KPI's "occupied". "Leased" there is the larger figure that
      // also counts signed leases not yet in and sublet space, so it is not this item's word.
      { tone: 'leased', label: 'Occupied' },
      { tone: 'muted', label: 'Not available' },
    ];
  switch (lens) {
    case 'status':
      return [
        { tone: 'available', label: 'Available (direct)' },
        { tone: 'available-later', label: 'Available later', pattern: 'dashed' },
        { tone: 'sublease', label: 'Sublease', pattern: 'dots' },
        { tone: 'committed', label: 'Signed, not yet in', pattern: 'hatch' },
        { tone: 'forsale', label: 'For sale' },
        { tone: 'leased', label: 'Leased, > 12 mo' },
        { tone: 'expiring', label: 'Expires < 12 mo' },
        { tone: 'risk', label: 'Holdover / month-to-month' },
        { tone: 'projected', label: 'Projected vacancy', pattern: 'dashed' },
        { tone: 'empty', label: 'Vacant, not listed', pattern: 'dashed' },
      ];
    case 'expiry':
      // Prospect-safe: lease terms are withheld, so the legend has no ramp to explain.
      if (!canShowLeaseTerm(prospectSafe))
        return [
          { tone: 'leased', label: 'Leased' },
          { tone: 'sublease', label: 'Sublease', pattern: 'dots' },
          { tone: 'committed', label: 'Signed, not yet in', pattern: 'hatch' },
          { tone: 'projected', label: 'Projected vacancy', pattern: 'dashed' },
          { tone: 'empty', label: 'Vacant', pattern: 'dashed' },
          { tone: 'muted', label: 'For sale' },
        ];
      return [
        { tone: 'exp-0', label: '< 6 mo' },
        { tone: 'exp-1', label: '6–12 mo' },
        { tone: 'exp-2', label: '1–2 yr' },
        { tone: 'exp-3', label: '2–3 yr' },
        { tone: 'exp-4', label: '3–5 yr' },
        { tone: 'exp-5', label: '5+ yr' },
        { tone: 'risk', label: 'Holdover / month-to-month' },
        { tone: 'committed', label: 'Signed, not yet in', pattern: 'hatch' },
        { tone: 'projected', label: 'Projected vacancy', pattern: 'dashed' },
        { tone: 'empty', label: 'Vacant', pattern: 'dashed' },
        { tone: 'muted', label: 'For sale (no lease term)' },
      ];
    case 'deals':
      return prospectSafe
        ? [
            { tone: 'empty', label: 'Available', pattern: 'dashed' },
            { tone: 'muted', label: 'Not available' },
            { tone: 'forsale', label: 'For sale' },
          ]
        : [
            { tone: 'deal-3', label: 'Lease drafted' },
            { tone: 'deal-2', label: 'LOI' },
            { tone: 'deal-1', label: 'Proposal' },
            { tone: 'deal-0', label: 'Tour' },
            { tone: 'deal-none', label: 'Vacant, no deal', pattern: 'dashed' },
            { tone: 'muted', label: 'Leased, no deal' },
            { tone: 'forsale', label: 'For sale' },
          ];
    case 'rent':
      return [
        { tone: 'rent-0', label: 'Gross < $28' },
        { tone: 'rent-1', label: '$28–30.99' },
        { tone: 'rent-2', label: '$31–33.99' },
        { tone: 'rent-3', label: '$34–37.99' },
        { tone: 'rent-4', label: '$38+' },
        { tone: 'rent-net', label: 'Net or modified gross', pattern: 'topbar' },
        { tone: 'empty', label: 'Asking rent (vacancy)', pattern: 'asking' },
        { tone: 'confidential', label: 'Confidential' },
        { tone: 'muted', label: prospectSafe ? 'Rent withheld' : 'No rent on record' },
        { tone: 'forsale', label: 'For sale' },
      ];
  }
}


/**
 * Legend for a lens with the SF and share (of total leasable) each tone covers
 * on the given floors.
 *
 * On an over-allocated floor the lease SF is scaled down to the floor's capped
 * `leased` figure (the same rule `computeKpis` uses), so the excess is reported as
 * an issue and never counted here; shares therefore never exceed 1. SF is kept
 * to whole feet. The rent lens's "Asking rent" entry is a pattern overlay, not a
 * tone: its SF is the vacant space carrying an asking rent, and its share is that SF
 * over leasable like every other item's. The same space is also counted in the rent
 * band it falls in (`overlay` says so), so the overlay is left out when shares are summed.
 */
export function legendFor(lens: LensId, prospectSafe: boolean, floors: FloorView[]): LegendItem[] {
  const leasable = floors.reduce((s, f) => s + f.leasable, 0);
  const byTone = new Map<Tone, number>();
  let asking = 0;
  for (const f of floors) {
    for (const seg of f.segments) {
      // Recorded SF, exactly as the records say; an over-allocated floor is footnoted, never pro-rated.
      const sf = seg.size;
      const t = toneFor(seg, lens, prospectSafe);
      byTone.set(t, (byTone.get(t) ?? 0) + sf);
      if (seg.availability && (seg.kind === 'available' || seg.kind === 'sublease')) asking += sf;
    }
  }
  return legendSpecs(lens, prospectSafe).map((item) => {
    const overlay = item.pattern === 'asking';
    const sf = overlay ? asking : (byTone.get(item.tone) ?? 0);
    return { ...item, sf, share: leasable <= 0 ? 0 : sf / leasable, ...(overlay ? { overlay: true } : {}) };
  });
}

/** Legend wording for a tone in a lens ("Expires < 12 mo"), for tooltips and accessible names. */
export function toneLabel(tone: Tone, lens: LensId, prospectSafe: boolean): string {
  return legendSpecs(lens, prospectSafe).find((i) => i.tone === tone)?.label ?? '';
}

/** One or two words for a tone, for tight places (the map's floor rail). */
export function toneShort(tone: Tone, lens: LensId, prospectSafe: boolean): string {
  if (lens !== 'status') return toneLabel(tone, lens, prospectSafe);
  const words: Partial<Record<Tone, string>> = { available: 'Available', 'available-later': 'Coming', sublease: 'Sublease', committed: 'Committed', forsale: 'For sale', leased: 'Leased', expiring: 'Expiring', risk: 'At risk', empty: 'Vacant', projected: 'Vacating', neutral: 'Leased' };
  return words[tone] ?? toneLabel(tone, lens, prospectSafe);
}

/** The lens's name, as the toolbar and the legend's title both say it. */
export const lensName = (id: LensId): string => LENSES.find((l) => l.id === id)!.label;

/** A deal stage as people read it: the CRM's "Lease Out" (lease out for signature) is "Lease drafted". */
export const stageLabel = (stage: DealStage): string => (stage === 'Lease Out' ? 'Lease drafted' : stage);
