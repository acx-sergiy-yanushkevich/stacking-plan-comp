import type { Segment } from '../../domain/derive';
import type { ISODate } from '../../domain/types';
import { fmtDate, fmtMonthYear, fmtMonthYearShort, fmtMonths } from '../../domain/dates';
import { compactRate, num, rate, sf, usd, usd0 } from '../../domain/format';
import { dealCount, rentType, rentValue, topDeal, toneFor, type LensId, type Tone, stageLabel } from '../../domain/lenses';
import { canShowActivity, canShowDeals, canShowInPlaceRent, canShowIssues, canShowLeaseTerm, canShowListingStatus, canShowTenant, canShowTenantRisk, leaseDatesHidden, marketedFor, rentVisible, tenantLabel, termHidden } from '../../domain/safe';
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
  /** Short lens value for cramped blocks ("Oct '27", "$30 FSG", "LOI"); '' when none. */
  lensShort: string;
  /**
   * The lease's term in a few words ("Exp Feb '27", "Holdover", "Month-to-month"), in the lenses about
   * dates (status, expiry) and only where lease terms may be shown; '' otherwise. Print only: a narrow
   * block on paper keeps it on a merged line before it is given up (`Block`, `keepSuite`). The screen
   * draws `meta` and `lensShort` as before.
   */
  term?: string;
}

export interface SegmentTextOptions {
  safe: boolean;
  asOf: ISODate;
  lens: LensId;
  floorName: string;
  /** Inquiry matches to show as a badge when the finder is active. */
  matches?: number;
  /** Badge wording when the matches refer to one specific inquiry. */
  matchLabel?: string;
  /** Real today (activity ages are measured from today, never from a projected date). */
  today?: ISODate;
  /** Why a search matched this block (shown as a badge). */
  matchReason?: string;
  /** This suite is (part of) the building's largest contiguous block of direct space, the one the KPI reports. */
  largest?: boolean;
}

/** The words that mark the building's largest block wherever it is shown: a floor's label, a suite's badge. */
export const LARGEST_BLOCK = 'Largest block';

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

/** A badge as it is spoken or listed: the deal badge draws only its count ("1"), which means nothing read alone. */
export const badgeLabel = (b: Badge): string => (b.kind === 'deal' ? `${b.text} live deal${b.text === '1' ? '' : 's'}` : b.text);

export function segmentText(seg: Segment, o: SegmentTextOptions): SegmentText {
  const { safe, lens } = o;
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
  // First of the badges: it is the answer to "where is the largest block", and it describes space, so a prospect sees it too.
  if (o.largest) badges.push({ kind: 'info', text: LARGEST_BLOCK, title: 'The largest contiguous block of direct space in the building' });

  switch (kind) {
    case 'leased':
    case 'holdover':
    case 'mtm':
    case 'sublease': {
      name = lease ? tenantLabel(lease, safe) : name;
      if (kind === 'sublease' && a) name = lease && canShowTenant(safe) ? `${lease.tenant} · sublease` : 'Sublease';
      if (kind === 'holdover' && canShowTenantRisk(safe)) badges.push({ kind: 'risk', text: 'Holdover', title: `Expired ${seg.endDate ? fmtDate(seg.endDate) : ''}, no termination recorded` });
      if (kind === 'mtm' && canShowTenantRisk(safe)) badges.push({ kind: 'risk', text: 'MTM', title: 'Month-to-month: no expiration date' });
      // Prospect-safe: no lease in place shows its term. Every one reads "Leased", so a holdover or a
      // month-to-month lease cannot be told from an ordinary one by a missing date.
      if (termHidden(kind, safe)) meta = kind === 'sublease' ? '' : 'Leased';
      else if (kind === 'mtm') meta = 'Month-to-month';
      else if (kind === 'holdover') meta = `Expired ${seg.endDate ? fmtMonthYear(seg.endDate) : ''}`;
      else if (seg.endDate && seg.monthsToExpiry !== null) meta = `Exp ${fmtMonthYear(seg.endDate)} · ${fmtMonths(seg.monthsToExpiry)}`;
      // To the broker a sublet suite says how long the sublease runs. A prospect is given no end date
      // (it is the sublandlord's lease end; `safeFloors` has already removed it) and reads what any
      // space on offer says instead: the asking rent, with its unit and lease type.
      if (kind === 'sublease' && a?.subleaseExpiration && canShowLeaseTerm(safe)) meta = `Sublease thru ${fmtMonthYear(a.subleaseExpiration)}`;
      else if (kind === 'sublease' && a && termHidden(kind, safe) && rentVisible(a, safe) && a.rentHigh > 0) meta = compactRate(a.rentLow, a.rentHigh, a.rateUnit, a.leaseType);
      // A quiet listing is not shown to a prospect at all; to the broker it is marked as quiet.
      const marketed = marketedFor(seg, safe);
      if (marketed && !marketed.sublease && marketed.kind === 'Lease') {
        badges.push({ kind: 'info', text: marketed.availableFrom ? `Avail ${fmtMonthYearShort(marketed.availableFrom)}` : 'Marketed', title: `Occupied, already marketed for a later date${marketed.published === false ? ' · quiet listing, not published' : ''}` });
      }
      if (marketed?.kind === 'Sale') badges.push({ kind: 'sale', text: 'For sale' });
      if (seg.next && canShowTenant(safe)) badges.push({ kind: 'info', text: `Next: ${seg.next.lease.tenant}`, title: `Signed lease commences ${fmtDate(seg.next.lease.commencement)}` });
      // The lock would single one tenant out, so prospect-safe withholds every in-place rent the same way.
      if (lease?.confidential && canShowTenant(safe)) badges.push({ kind: 'lock', text: 'Confidential', title: 'Rent is confidential' });
      break;
    }
    case 'committed': {
      name = lease && canShowTenant(safe) ? lease.tenant : name;
      // Prospect-safe: a signed lease shows no date either; the badge says what it is.
      meta = lease && !leaseDatesHidden(kind, safe) ? `Moves in ${fmtMonthYear(lease.commencement)}` : '';
      badges.push({ kind: 'info', text: 'Signed, not in', title: 'Lease signed; tenant has not taken occupancy' });
      break;
    }
    case 'available': {
      name = seg.availableFrom ? `Available ${fmtMonthYearShort(seg.availableFrom)}` : 'Available now';
      if (a) meta = `${a.sublease ? 'Sublease' : 'Direct'}${a.divisible && a.minDivisible ? ` · divisible to ${num(a.minDivisible)}` : ''}`;
      if (a && rentVisible(a, safe) && a.rentHigh > 0) meta = compactRate(a.rentLow, a.rentHigh, a.rateUnit, a.leaseType);
      if (a && a.published === false && canShowListingStatus(safe)) badges.push({ kind: 'info', text: 'Quiet', title: 'Listing not published to marketing channels' });
      break;
    }
    case 'projected': {
      name = seg.endDate ? `Vacated\u00a0${fmtMonthYearShort(seg.endDate)}` : 'Projected vacancy';
      meta = lease && canShowTenant(safe) ? `${lease.tenant} ${seg.endDate && seg.endDate < o.asOf ? 'left' : 'leaves'}${seg.endDate && seg.endDate < o.asOf ? ` ${fmtMonthYearShort(seg.endDate)}` : ''}` : 'No availability yet';
      break;
    }
    case 'unmarketed': {
      // A gap in the records is a data issue; a prospect sees space that is simply not on offer.
      if (canShowIssues(safe)) {
        name = `${sf(seg.size)} unaccounted`;
        meta = seg.suspect ? `Likely ${seg.suspect.tenant}` : 'No lease or availability';
        badges.push({ kind: 'warn', text: 'Data gap' });
      } else {
        name = `${sf(seg.size)} not available`;
        meta = 'Not on the market';
      }
      break;
    }
    case 'forsale': {
      name = 'For sale';
      meta = a?.askingPrice ? `${usd0(a.askingPrice)} · ${usd(a.askingPrice / seg.size)}/SF` : 'Condo unit';
      badges.push({ kind: 'sale', text: 'Sale' });
      break;
    }
  }

  // Lens-specific line 3 overrides
  if (lens === 'expiry' && seg.monthsToExpiry !== null && !leaseDatesHidden(kind, safe) && (kind === 'leased' || kind === 'sublease' || kind === 'committed')) {
    meta = `${fmtMonths(seg.monthsToExpiry)} left${seg.endDate ? ` · ${fmtMonthYearShort(seg.endDate)}` : ''}`;
  }
  if (lens === 'rent') {
    const v = rentValue(seg);
    const t = rentType(seg);
    if (!canShowInPlaceRent(safe) && kind !== 'available' && kind !== 'sublease') meta = 'Rent hidden';
    else if (seg.lease?.confidential && kind !== 'available') meta = 'Rent confidential';
    else if (v !== null && t && seg.availability && (kind === 'available' || kind === 'sublease'))
      meta = `Asking ${compactRate(seg.availability.rentLow, seg.availability.rentHigh, seg.availability.rateUnit, seg.availability.leaseType)}`;
    else if (v !== null && t && seg.lease && seg.lease.rate !== null) meta = rate(seg.lease.rate, seg.lease.rateUnit, seg.lease.leaseType);
  }
  if (lens === 'deals' && canShowDeals(safe)) {
    const d = topDeal(seg);
    if (d) meta = `${d.stage} · ${d.prospect}${d.kind === 'Renewal' ? ' (renewal)' : ''}`;
    else if (kind === 'available' || kind === 'projected' || kind === 'unmarketed') meta = 'No live deal';
  }

  const deals = canShowDeals(safe) ? dealCount(seg) : 0;
  if (deals > 0) badges.push({ kind: 'deal', text: String(deals), title: `${deals} live deal${deals === 1 ? '' : 's'}` });
  if (o.matches) badges.push({ kind: 'match', text: o.matchLabel ?? (o.matches === 1 ? '1 inquiry fits' : `${o.matches} inquiries fit`), title: o.matchLabel ? 'This space satisfies the inquiry being matched' : 'Open inquiries this space could satisfy' });
  // CRM on the canvas: how recently the tenant relationship was touched, for leases inside the renewal window.
  const projected = !!o.today && o.today !== o.asOf;
  const touchable = canShowActivity(safe) && !projected && !!lease && (kind === 'leased' || kind === 'holdover' || kind === 'mtm');
  if (touchable && lease.lastTouch && (seg.monthsToExpiry === null || seg.monthsToExpiry <= 24)) {
    const days = Math.max(0, Math.round((Date.parse(o.today ?? o.asOf) - Date.parse(lease.lastTouch.date)) / 86_400_000));
    badges.push({ kind: days <= 30 ? 'info' : days <= 90 ? 'warn' : 'risk', text: `${lease.lastTouch.type} ${days} d`, title: `Last touch: ${lease.lastTouch.type} ${days} days ago by ${lease.lastTouch.by}` });
  } else if (touchable && !lease.lastTouch && seg.monthsToExpiry !== null && seg.monthsToExpiry <= 12) {
    // Silence is the norm 1–2 years out; flag it only inside the year, where a renewal should be under way.
    badges.push({ kind: 'info', text: 'No activity', title: 'No activity logged on this tenant' });
  }

  // Short lens value: the one fact the active lens colours by, in a few characters.
  let lensShort = '';
  if ((lens === 'expiry' || lens === 'status') && seg.endDate && !leaseDatesHidden(kind, safe) && (kind === 'leased' || kind === 'sublease' || kind === 'committed')) lensShort = fmtMonthYearShort(seg.endDate);
  if (lens === 'rent') {
    const v = rentValue(seg);
    const t = rentType(seg);
    if (v !== null && t && !(seg.lease?.confidential && kind !== 'available') && !(!canShowInPlaceRent(safe) && kind !== 'available' && kind !== 'sublease')) {
      // Exact figure with its unit, never rounded: "$29.75/yr FSG" (the lease's own unit, as recorded).
      const unit = seg.lease ? seg.lease.rateUnit : seg.availability?.rateUnit ?? 'yr';
      const asking = (kind === 'available' || kind === 'sublease') && seg.availability;
      if (asking) lensShort = compactRate(asking.rentLow, asking.rentHigh, asking.rateUnit, t);
      else {
        const raw = seg.lease && seg.lease.rate !== null ? seg.lease.rate : v;
        lensShort = `$${Number.isInteger(raw) ? raw : raw.toFixed(2)}/SF/${unit} ${t}`;
      }
    }
  }
  if (lens === 'deals' && canShowDeals(safe)) {
    const d = topDeal(seg);
    if (d) lensShort = stageLabel(d.stage);
  }
  if (kind === 'committed' && lens === 'status' && lease && !leaseDatesHidden(kind, safe)) lensShort = `In ${fmtMonthYearShort(lease.commencement)}`;
  let term = '';
  if ((lens === 'status' || lens === 'expiry') && lease && !termHidden(kind, safe)) {
    if (kind === 'holdover') term = 'Holdover';
    else if (kind === 'mtm') term = 'Month-to-month';
    else if (kind === 'leased' && seg.endDate) term = `Exp ${fmtMonthYearShort(seg.endDate)}`;
  }
  const lines = [name, sub, meta].filter(Boolean);
  const badgeText = badges.map(badgeLabel).join(', ');
  const tooltip = [...lines, badgeText].filter(Boolean).join('\n');
  const aria = `${o.floorName}, ${lines.join(', ')}${badgeText ? `, ${badgeText}` : ''}`;
  return { tone, pattern, name, sub, meta, badges, tooltip, aria, sfShort: num(seg.size), lensShort, term };
}

export function kindLabel(kind: Segment['kind']): string {
  return KIND_LABEL[kind];
}
