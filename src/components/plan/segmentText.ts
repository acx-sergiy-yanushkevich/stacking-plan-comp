import type { Segment } from '../../domain/derive';
import type { ISODate } from '../../domain/types';
import { fmtDate, fmtMonthYear, fmtMonthYearShort, fmtMonths } from '../../domain/dates';
import { compactRate, num, rate, sf, usd0 } from '../../domain/format';
import { dealCount, rentType, rentValue, topDeal, toneFor, type LensId, type Tone } from '../../domain/lenses';
import { prospectLabel, rentVisible, tenantLabel } from '../../domain/safe';
import type { PatternKind } from './Patterns';

export interface Badge {
  text: string;
  kind: 'risk' | 'warn' | 'info' | 'deal' | 'sale' | 'lock' | 'match';
  title?: string;
}

/** Everything a block, bar or slice needs to say about a segment, in one place. */
export interface SegmentText {
  tone: Tone;
  pattern: PatternKind;
  /** Line 1: tenant or state. */
  name: string;
  /** Line 2: suite and SF. */
  sub: string;
  /** Line 3: lens-specific fact. */
  meta: string;
  badges: Badge[];
  /** Native tooltip (multi-line). */
  tooltip: string;
  /** Accessible name for the block button. */
  aria: string;
  /** Short SF only, for the narrowest tier. */
  sfShort: string;
}

export interface SegmentTextOptions {
  safe: boolean;
  asOf: ISODate;
  lens: LensId;
  floorName: string;
  /** Inquiry matches to show as a badge when the finder is active. */
  matches?: number;
  /** Real today (activity ages are measured from today, never from a projected date). */
  today?: ISODate;
  /** Why a search matched this block (shown as a badge). */
  matchReason?: string;
}

const KIND_LABEL: Record<Segment['kind'], string> = {
  leased: 'Leased',
  holdover: 'Holdover',
  mtm: 'Month-to-month',
  available: 'Available',
  sublease: 'Sublease',
  committed: 'Committed',
  projected: 'Projected vacancy',
  unmarketed: 'Unaccounted',
  forsale: 'For sale',
};

export function patternFor(seg: Segment, tone: Tone, lens: LensId): PatternKind {
  if (seg.kind === 'committed') return 'hatch';
  if (seg.kind === 'sublease') return 'dots';
  if (seg.kind === 'unmarketed' || seg.kind === 'projected' || tone === 'available-later' || tone === 'empty' || tone === 'deal-none') return 'dashed';
  if (lens === 'rent' && seg.kind === 'available') return 'asking';
  if (tone === 'rent-net') return 'topbar';
  return null;
}

export function segmentText(seg: Segment, o: SegmentTextOptions): SegmentText {
  const { safe, lens } = o;
  void o.asOf;
  const kind: Segment['kind'] = seg.kind;
  const tone = toneFor(seg, lens, safe);
  const pattern = patternFor(seg, tone, lens);
  const suite = seg.suite ? `Ste ${seg.suite}` : o.floorName;
  const sub = `${suite} · ${sf(seg.size)}`;
  const badges: Badge[] = [];
  let name = KIND_LABEL[kind];
  let meta = '';
  const lease = seg.lease;
  const a = seg.availability;

  switch (kind) {
    case 'leased':
    case 'holdover':
    case 'mtm':
    case 'sublease': {
      name = lease ? tenantLabel(lease, safe) : name;
      if (kind === 'sublease' && a) name = safe ? 'Sublease' : `${tenantLabel(lease!, safe)} · sublease`;
      if (kind === 'holdover' && !safe) badges.push({ kind: 'risk', text: 'Holdover', title: `Expired ${seg.endDate ? fmtDate(seg.endDate) : ''}, no termination recorded` });
      if (kind === 'mtm' && !safe) badges.push({ kind: 'risk', text: 'MTM', title: 'Month-to-month: no expiration date' });
      if (kind === 'mtm') meta = 'Month-to-month';
      else if (kind === 'holdover') meta = `Expired ${seg.endDate ? fmtMonthYear(seg.endDate) : ''}`;
      else if (seg.endDate && seg.monthsToExpiry !== null) meta = `Exp ${fmtMonthYear(seg.endDate)} · ${fmtMonths(seg.monthsToExpiry)}`;
      if (kind === 'sublease' && a?.subleaseExpiration) meta = `Sublease thru ${fmtMonthYear(a.subleaseExpiration)}`;
      if (safe && (kind === 'holdover' || kind === 'mtm')) meta = 'Leased';
      if (seg.marketed && !seg.marketed.sublease && seg.marketed.kind === 'Lease') {
        badges.push({ kind: 'info', text: seg.marketed.availableFrom ? `Avail ${fmtMonthYearShort(seg.marketed.availableFrom)}` : 'Marketed', title: 'Occupied, already marketed for a later date' });
      }
      if (seg.marketed?.kind === 'Sale') badges.push({ kind: 'sale', text: 'For sale' });
      if (seg.next && !safe) badges.push({ kind: 'info', text: `Next: ${tenantLabel(seg.next.lease, safe)}`, title: `Signed lease commences ${fmtDate(seg.next.lease.commencement)}` });
      if (lease?.confidential && !safe) badges.push({ kind: 'lock', text: 'Confidential', title: 'Rent is confidential' });
      break;
    }
    case 'committed': {
      name = lease ? (safe ? 'Committed' : `${tenantLabel(lease, safe)}`) : name;
      meta = lease ? `Moves in ${fmtMonthYear(lease.commencement)}` : '';
      badges.push({ kind: 'info', text: 'Signed, not in', title: 'Lease signed; tenant has not taken occupancy' });
      break;
    }
    case 'available': {
      name = seg.availableFrom ? `Available ${fmtMonthYearShort(seg.availableFrom)}` : 'Available now';
      if (a) meta = `${a.sublease ? 'Sublease' : 'Direct'}${a.divisible && a.minDivisible ? ` · divisible to ${num(a.minDivisible)}` : ''}`;
      if (a && rentVisible(a, safe) && a.rentHigh > 0) meta = compactRate(a.rentLow, a.rentHigh, a.rateUnit, a.leaseType);
      break;
    }
    case 'projected': {
      name = seg.endDate ? `Vacated\u00a0${fmtMonthYearShort(seg.endDate)}` : 'Projected vacancy';
      meta = lease && !safe ? `${tenantLabel(lease, safe)} leaves` : 'No availability yet';
      break;
    }
    case 'unmarketed': {
      name = safe ? `${sf(seg.size)} not available` : `${sf(seg.size)} unaccounted`;
      meta = safe ? 'Not on the market' : seg.suspect ? `Likely ${seg.suspect.tenant}` : 'No lease or availability';
      if (!safe) badges.push({ kind: 'warn', text: 'Data gap' });
      break;
    }
    case 'forsale': {
      name = 'For sale';
      meta = a?.askingPrice ? `${usd0(a.askingPrice)} · ${usd0(Math.round(a.askingPrice / seg.size))}/SF` : 'Condo unit';
      badges.push({ kind: 'sale', text: 'Sale' });
      break;
    }
  }

  // Lens-specific line 3 overrides
  if (lens === 'expiry' && seg.monthsToExpiry !== null && (kind === 'leased' || kind === 'sublease' || kind === 'committed')) {
    meta = `${fmtMonths(seg.monthsToExpiry)} left${seg.endDate ? ` · ${fmtMonthYearShort(seg.endDate)}` : ''}`;
  }
  if (lens === 'rent') {
    const v = rentValue(seg);
    const t = rentType(seg);
    if (seg.lease?.confidential && kind !== 'available') meta = 'Rent confidential';
    else if (safe && kind !== 'available' && kind !== 'sublease') meta = 'Rent hidden';
    else if (v !== null && t && seg.availability && (kind === 'available' || kind === 'sublease'))
      meta = `Asking ${compactRate(seg.availability.rentLow, seg.availability.rentHigh, seg.availability.rateUnit, seg.availability.leaseType)}`;
    else if (v !== null && t && seg.lease && seg.lease.rate !== null) meta = rate(seg.lease.rate, seg.lease.rateUnit, seg.lease.leaseType);
  }
  if (lens === 'deals' && !safe) {
    const d = topDeal(seg);
    if (d) meta = `${d.stage} · ${prospectLabel(d, safe)}${d.kind === 'Renewal' ? ' (renewal)' : ''}`;
    else if (kind === 'available' || kind === 'projected' || kind === 'unmarketed') meta = 'No live deal';
  }

  const deals = safe ? 0 : dealCount(seg);
  if (deals > 0) badges.push({ kind: 'deal', text: String(deals), title: `${deals} live deal${deals === 1 ? '' : 's'}` });
  if (o.matches) badges.push({ kind: 'match', text: o.matches === 1 ? '1 inquiry fits' : `${o.matches} inquiries fit`, title: 'Open inquiries this space could satisfy' });
  // CRM on the canvas: how recently the tenant relationship was touched, for leases inside the renewal window.
  const projected = !!o.today && o.today !== o.asOf;
  if (!safe && !projected && lease?.lastTouch && (kind === 'leased' || kind === 'holdover' || kind === 'mtm') && (seg.monthsToExpiry === null || seg.monthsToExpiry <= 24)) {
    const days = Math.max(0, Math.round((Date.parse(o.today ?? o.asOf) - Date.parse(lease.lastTouch.date)) / 86_400_000));
    badges.push({ kind: days <= 30 ? 'info' : days <= 90 ? 'warn' : 'risk', text: `${lease.lastTouch.type} ${days} d`, title: `Last touch: ${lease.lastTouch.type} ${days} days ago by ${lease.lastTouch.by}` });
  } else if (!safe && !projected && lease && !lease.lastTouch && (kind === 'leased' || kind === 'holdover' || kind === 'mtm') && seg.monthsToExpiry !== null && seg.monthsToExpiry <= 24) {
    badges.push({ kind: 'info', text: 'No activity', title: 'No activity logged on this tenant' });
  }

  const lines = [name, sub, meta].filter(Boolean);
  const badgeText = badges.map((b) => (b.kind === 'deal' ? `${b.text} live deal${b.text === '1' ? '' : 's'}` : b.text)).join(', ');
  const tooltip = [...lines, badgeText].filter(Boolean).join('\n');
  const aria = `${o.floorName}, ${lines.join(', ')}${badgeText ? `, ${badgeText}` : ''}`;
  return { tone, pattern, name, sub, meta, badges, tooltip, aria, sfShort: num(seg.size) };
}

export function kindLabel(kind: Segment['kind']): string {
  return KIND_LABEL[kind];
}

export { fmtMonths };
