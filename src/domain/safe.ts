import { deriveFloors, floorTotals, type FloorView, type Segment, type SegmentKind } from './derive';
import type { Kpis } from './kpis';
import type { RolloverBucket } from './rollover';
import type { Availability, Deal, ISODate, Lease, Property } from './types';

/**
 * The prospect-safe policy, in one module. `safe=1` is what a broker shows a prospect: the building,
 * its space and its asking rents, and nothing about the people in it or the landlord's own work.
 *
 * Nothing outside this file decides what a prospect may see. A component asks a named question
 * (`canShowDeals`), takes a list through its projection (`visibleDeals`, which is empty when
 * withheld) or reads a field through its accessor (`marketedFor`, `tenantLabel`). A new list that
 * forgets the question still receives nothing to render.
 *
 *   Withheld from a prospect                     Ask
 *   tenant name, contact, industry               tenantLabel · contactLabel · canShowTenant
 *   in-place and confidential rents              rentVisible · canShowInPlaceRent
 *   holdover and month-to-month                  canShowTenantRisk
 *   every date of every lease (see below)        canShowLeaseTerm · termHidden · leaseDatesHidden · safeFloors
 *   the end date of a sublease                   safeFloors (it is its sublandlord's lease end)
 *   the renewal worklist, expiry highlighting    canShowLeaseTerm
 *   the Expiration and Deals lenses              canUseLens (state/planState.ts falls back to Status)
 *   SF and leases ending per period              canShowRollover · safeRollover · safeKpis
 *   WALT                                         canShowWalt · safeKpis
 *   any as-of date but today                     canTimeTravel · planDate (state/planState.ts holds the URL to it)
 *   deals: stage, prospect, size, counts         canShowDeals · visibleDeals · prospectLabel
 *   open inquiries and where they came from      canShowInquiries · visibleInquiries
 *   an inquiry matched before the mode went on   canShowInquiries (state/planState.ts drops it, like a search)
 *   data issues, counts included                 canShowIssues · visibleIssues
 *   brokers and record owners                    canShowBrokers · brokerLabel
 *   last touch, change history, verified stamps  canShowActivity
 *   quiet (unpublished) listings                 listingVisible · marketedFor · publishedFloors
 *   whether a listing is quiet or published      canShowListingStatus
 *   record actions (they name the record)        canShowRecordActions
 *   a search typed before the mode was turned on canKeepSearch (state/planState.ts applies it)
 *
 * The rule for leases, in five parts. Each closes a way of working out what the one before withheld.
 *
 * 1. No date of any lease. A prospect is shown no commencement date, no end date and no time remaining,
 *    for a lease in place or for one that is signed and not yet in. A lease in place reads "Leased"
 *    whether it runs to 2034, expired last year (holdover) or never had an end date (month-to-month),
 *    so none stands out by what it lacks; a signed lease reads "Signed, not in". `safeFloors` removes
 *    the dates from the segment and from the lease record it carries, so a view that never asks still
 *    has no date to print. Space on offer keeps what is its own: size, available-from date, asking rent.
 *
 * 2. No end date of a sublease. A sublease cannot outlast the lease it is cut from, and it usually runs
 *    to that lease's last day: "thru Sep 30, 2030" on a sublet suite is its sublandlord's lease end, the
 *    one lease date a prospect could still read. `safeFloors` removes it from the suite and from the
 *    listing the suite carries (and from a sublease listed for later, and one with no suite to sit on),
 *    so the plan, the timeline, the inspector, the print and the CSV have no date to show. A sublet
 *    suite is still space on offer: its size, its available-from date and its asking rent. The term
 *    of a sublease is a question for the broker, like the term of any other space.
 *
 * 3. Nothing by period. With every suite's RSF on the page, "4–5 yr · 13,400 SF · 1 lease" can only
 *    be one suite, and "35,300 SF expiring in 12 months" only one set of suites. So the rollover by
 *    period (table, chart, timeline band, chips) and the Expiring 12 mo figure are withheld, lease
 *    counts included. `safeRollover` and `safeKpis` hand a prospect-safe caller no period and no figure.
 *    The Expiration lens goes with them (`canUseLens`): with no term to colour by it could only repeat
 *    the Status lens under another name.
 *
 * 4. Today only. Moving the as-of date re-draws each lease as vacated once it has ended, which gives
 *    every end date away one step at a time. A prospect-safe plan is always drawn as of today
 *    (`planDate`): a link's `asOf` is ignored, turning the mode on returns to today and the as-of
 *    controls are off. No history of ended leases is drawn either.
 *
 * 5. A quiet listing is never drawn, whatever the suite's state: not as a badge on an occupied suite,
 *    not as available space, not as a sublease (`publishedFloors`).
 *
 * WALT is withheld too (`canShowWalt`). On its own it is one equation in as many unknowns as there are
 * leases and dates no single one of them, but it is a figure made of nothing except lease terms, and a
 * plan that says "lease terms are not shown" beside it contradicts itself. The screen, the print and
 * the CSV say "Withheld" (or say nothing); `safeKpis` hands a caller that forgets to ask a zero.
 * Occupancy, available SF and the largest block stay: they describe space, not terms.
 *
 * What the switch takes off the plan on the way in (the broker's as-of date, lens, worklist, rollover
 * highlight, search and matched inquiry) is put back when it is turned off again. It is remembered
 * beside the state, never in it (`state/planState.ts`, `PlanSession`): while the mode is on, nothing
 * that is drawn, read by the model or written to the URL holds any of it, and a link opened with
 * `safe=1` has nothing to bring back.
 */

export const TITLE = 'Stax by Ascendix';
export const SAFE_TITLE = 'Stax by Ascendix (prospect-safe)';

export const tenantLabel = (lease: Pick<Lease, 'tenant'>, safe: boolean): string => (safe ? 'Tenant' : lease.tenant);

export const contactLabel = (contact: string | undefined, safe: boolean): string | undefined => (safe ? undefined : contact);

export const prospectLabel = (deal: Pick<Deal, 'prospect'>, safe: boolean): string => (safe ? 'Prospect' : deal.prospect);

/** A broker or record owner by name; undefined when withheld, so the row drops it. */
export const brokerLabel = (broker: string | undefined, safe: boolean): string | undefined => (canShowBrokers(safe) ? broker : undefined);

/**
 * Rents and prices show only outside prospect-safe mode and never for confidential
 * records. Availabilities have no Confidential__c, so only `safe` applies to them.
 */
export const rentVisible = (x: { confidential?: boolean } | Availability, safe: boolean): boolean => {
  // Asking rents on availabilities are marketing information a prospect is meant to see.
  if ('rentLow' in x) return true;
  return canShowInPlaceRent(safe) && !x.confidential;
};

/** In-place rents as a whole (the rent-by-type table, rent columns); `rentVisible` decides for one record. */
export const canShowInPlaceRent = (safe: boolean): boolean => !safe;

/** Who the tenant is beyond the name: industry, the tenant row itself, the next tenant signed for the suite. */
export const canShowTenant = (safe: boolean): boolean => !safe;

/** Holdover and month-to-month: a prospect sees a leased suite, never a tenant at risk. */
export const canShowTenantRisk = (safe: boolean): boolean => !safe;

/**
 * When a lease starts and ends: its dates, the months left, its colour on the expiration ramp, its
 * row in the renewal worklist. A prospect is shown none of it, for any lease (rule 1 above).
 */
export const canShowLeaseTerm = (safe: boolean): boolean => !safe;

const IN_PLACE: ReadonlySet<string> = new Set(['leased', 'holdover', 'mtm', 'sublease']);

/**
 * True when this segment is a lease in place that a prospect sees only as "Leased": ordinary,
 * holdover, month-to-month, and the head lease behind a sublet suite, so none stands out. The
 * sublease's own end date is withheld with it (rule 2 above): it is the head lease's end.
 */
export const termHidden = (kind: string, safe: boolean): boolean => !canShowLeaseTerm(safe) && IN_PLACE.has(kind);

/**
 * True when no date of this segment's lease may be shown: every lease in place (`termHidden`) and also
 * a lease that is signed and not yet in, whose move-in and end dates are lease dates like any other.
 */
export const leaseDatesHidden = (kind: string, safe: boolean): boolean => !canShowLeaseTerm(safe) && (IN_PLACE.has(kind) || kind === 'committed');

/** SF and leases ending per period, and the Expiring 12 mo figure (rule 3 above). */
export const canShowRollover = (safe: boolean): boolean => !safe;

/** WALT, the SF-weighted lease term remaining: a figure made only of lease terms, withheld with them. */
export const canShowWalt = (safe: boolean): boolean => canShowLeaseTerm(safe);

/**
 * Whether a lens may colour the plan. Deals colours by deal stage and Expiration by months to lease
 * end: a prospect is shown neither, so neither lens is offered and a link that names one draws Status.
 */
export const canUseLens = (lens: string, safe: boolean): boolean => (lens === 'deals' ? canShowDeals(safe) : lens === 'expiry' ? canShowLeaseTerm(safe) : true);

/** Whether the plan may be drawn for a date other than today (rule 4 above). */
export const canTimeTravel = (safe: boolean): boolean => !safe;

/** The date a plan is drawn for: the as-of date asked for, or today when time travel is withheld. */
export const planDate = (asOf: ISODate, today: ISODate, safe: boolean): ISODate => (canTimeTravel(safe) ? asOf : today);

/**
 * The rollover as a caller may show it: every period and the at-risk SF, or none of them. What is
 * left (`overAllocated`) names floors, not leases.
 */
export function safeRollover<T extends { buckets: RolloverBucket[]; atRisk: number }>(roll: T, safe: boolean): T {
  return canShowRollover(safe) ? roll : { ...roll, buckets: [], atRisk: 0 };
}

/**
 * The KPIs as a caller may show them: with or without the Expiring 12 mo figure, its lease count and
 * WALT. Ask `canShowRollover` / `canShowWalt` before printing them; a caller that forgets prints a
 * zero, not a leak.
 */
export function safeKpis(k: Kpis, safe: boolean): Kpis {
  if (canShowRollover(safe) && canShowWalt(safe) && canShowInPlaceRent(safe)) return k;
  return {
    ...k,
    ...(canShowRollover(safe) ? {} : { expiring12: 0, expiring12Leases: 0 }),
    ...(canShowWalt(safe) ? {} : { walt: 0 }),
    // In-place rents are withheld as a whole; the asking rents stay: they are the listings' own.
    ...(canShowInPlaceRent(safe) ? {} : { rentByType: [] }),
  };
}

/** Deal activity: stage, prospect, size, updated date, the pipeline and every deal count. */
export const canShowDeals = (safe: boolean): boolean => !safe;

/**
 * Other prospects' requirements: size, date needed and lead source. That covers an inquiry the broker
 * matched in the space finder before turning the mode on: its size range and needed-by date would be
 * the requirement on screen, so the state layer drops it at the boundary and the model never reads it.
 */
export const canShowInquiries = (safe: boolean): boolean => !safe;

/** Data issues: titles name tenants and risk, and even a count says the records are wrong. */
export const canShowIssues = (safe: boolean): boolean => !safe;

/** Brokers and record owners. */
export const canShowBrokers = (safe: boolean): boolean => !safe;

/** CRM activity: last touch, change history with its authors, verified and stale stamps on leases. */
export const canShowActivity = (safe: boolean): boolean => !safe;

/** Whether a listing is quiet or published: the landlord's marketing plan, not a prospect's business. */
export const canShowListingStatus = (safe: boolean): boolean => !safe;

/** Record actions open a named record (and write to it); a prospect-facing plan offers none. */
export const canShowRecordActions = (safe: boolean): boolean => !safe;

const withheld = <T>(items: readonly T[] | undefined, show: boolean): T[] => (show && items ? [...items] : []);

/** The deals a list may render: all of them, or none in prospect-safe mode. */
export const visibleDeals = <T>(deals: readonly T[] | undefined, safe: boolean): T[] => withheld(deals, canShowDeals(safe));

/** The inquiries a list may render: all of them, or none in prospect-safe mode. */
export const visibleInquiries = <T>(inquiries: readonly T[] | undefined, safe: boolean): T[] => withheld(inquiries, canShowInquiries(safe));

/** The data issues a list may render: all of them, or none in prospect-safe mode. */
export const visibleIssues = <T>(issues: readonly T[] | undefined, safe: boolean): T[] => withheld(issues, canShowIssues(safe));

/**
 * A quiet listing (`published === false`) is space the landlord is marketing off-market. A prospect
 * is shown published listings only; whether a listing is quiet or published is itself not shown.
 */
export const listingVisible = (a: Pick<Availability, 'published'>, safe: boolean): boolean => !safe || a.published !== false;

/** The marketed-for-later availability on an occupied suite, unless it is a quiet listing in prospect-safe mode. */
export const marketedFor = (seg: Pick<Segment, 'marketed'>, safe: boolean): Availability | undefined =>
  seg.marketed && listingVisible(seg.marketed, safe) ? seg.marketed : undefined;

/** The lease kind a suite goes back to when the sublease offered on it is a quiet listing. */
function headKind(s: Segment): SegmentKind {
  if (s.endDate === null) return 'mtm';
  return s.headMonths !== null && s.headMonths !== undefined && s.headMonths < 0 ? 'holdover' : 'leased';
}

/** One segment with any quiet listing taken out of it; the same object when it carries none. */
function withoutQuietListing(s: Segment): Segment {
  let out = s;
  if (out.marketed && out.marketed.published === false) out = { ...out, marketed: undefined };
  const a = out.availability;
  if (!a || a.published !== false) return out;
  // A sublet suite goes back to being the lease it is; its months are the head lease's again.
  if (out.kind === 'sublease') return { ...out, kind: headKind(out), availability: undefined, monthsToExpiry: out.headMonths ?? null, headMonths: undefined };
  // Vacant space listed quietly is, to a prospect, space that is not on the market. It is keyed as the floor's
  // space, not by the listing's record id, so neither the plan nor a link to the selected suite carries the
  // id of a listing that is not published (round 24's leak check: Cedar Springs drew "CS-A06").
  return { ...out, key: `${out.floorId}-gap-${out.order}`, kind: 'unmarketed', availability: undefined, lease: undefined, availableFrom: undefined };
}

/**
 * The floors with every quiet listing removed, whatever the suite's state, and nothing else changed:
 * an occupied suite loses its "marketed for later", a sublet suite goes back to leased, and vacant
 * space listed quietly becomes space that is not on the market. The floor's own figures are worked
 * out again from what is left. Building-wide totals (the KPIs) are computed from this: they need the
 * real lease terms, and they name no suite. Outside prospect-safe mode the input is returned as is.
 */
export function publishedFloors(floors: FloorView[], safe: boolean): FloorView[] {
  if (!safe) return floors;
  return floors.map((f) => {
    const segments = f.segments.map(withoutQuietListing);
    const orphans = f.orphanSubleases.filter((a) => listingVisible(a, safe));
    if (segments.every((s, i) => s === f.segments[i]) && orphans.length === f.orphanSubleases.length) return f;
    return { ...f, segments, ...floorTotals(segments, f.leasable), orphanSubleases: orphans };
  });
}

/** A lease record with its dates removed: what a prospect-safe segment carries. */
const withoutDates = (lease: Lease): Lease => ({ ...lease, commencement: '', expiration: null, termination: null });

/** A listing with a sublease's end date removed (rule 2 above); the same object when it has none. */
const withoutSubleaseEnd = <A extends Availability | undefined>(a: A): A => (a && a.subleaseExpiration ? { ...a, subleaseExpiration: null } : a);

/**
 * One segment as a prospect may see it (rule 1 above).
 *  - A lease in place: a leased suite with no start and no end. Holdover and month-to-month become
 *    plain `leased`, so nothing drawn from it (block, plate, bar, row, legend) can tell one lease
 *    from another.
 *  - A sublet suite stays `sublease`, space on offer, with no end either: the sublease's end is its
 *    sublandlord's lease end (rule 2 above), so it is taken off the listing as well as the segment.
 *    The same goes for a sublease listed for later on an occupied suite.
 *  - A lease signed and not yet in: still `committed`, with no move-in and no end date.
 *  - The signed lease that will replace the tenant (`next`) says the tenant is leaving: removed.
 *  - Space a lease used to occupy carries no trace of that lease, and a suite whose lease has ended
 *    with nothing on offer (`projected`, drawn only for a later as-of date) is space not on the market.
 */
function withoutTerm(s: Segment): Segment {
  const lease = s.lease && withoutDates(s.lease);
  const marketed = withoutSubleaseEnd(s.marketed);
  if (s.kind === 'sublease') {
    return { ...s, lease, marketed, availability: withoutSubleaseEnd(s.availability), next: undefined, endDate: null, monthsToExpiry: null, headMonths: null, termWithheld: true };
  }
  if (IN_PLACE.has(s.kind)) return { ...s, kind: 'leased', lease, marketed, next: undefined, endDate: null, monthsToExpiry: null, termWithheld: true };
  if (s.kind === 'committed') return { ...s, lease, marketed, endDate: null, monthsToExpiry: null, termWithheld: true };
  if (s.kind === 'projected') return { ...s, kind: 'unmarketed', lease: undefined, marketed, endDate: null, monthsToExpiry: null };
  const availability = withoutSubleaseEnd(s.availability);
  return s.lease || s.suspect || s.next || marketed !== s.marketed || availability !== s.availability ? { ...s, lease: undefined, suspect: undefined, next: undefined, marketed, availability } : s;
}

/**
 * The floors as a prospect may see them, for everything that draws or lists a suite: quiet listings
 * are removed (`publishedFloors`), every lease loses its dates and every sublease its end date
 * (`withoutTerm`), so anything computed from the result (blocks, bars, lists, the legend, finder
 * options, print, CSV) cannot show any of them. A new view that never asks `termHidden` still receives
 * no date to show. Pass floors derived for
 * `planDate`; floors derived for a later date come out with no vacated suite and no quiet listing
 * all the same. Outside prospect-safe mode the input is returned as is.
 */
export function safeFloors(floors: FloorView[], safe: boolean): FloorView[] {
  if (!safe) return floors;
  return publishedFloors(floors, safe).map((f) => {
    const segments = f.segments.map(withoutTerm);
    const orphans = f.orphanSubleases.map(withoutSubleaseEnd);
    if (segments.every((s, i) => s === f.segments[i]) && orphans.every((a, i) => a === f.orphanSubleases[i])) return f;
    return { ...f, segments, ...floorTotals(segments, f.leasable), orphanSubleases: orphans };
  });
}

/**
 * A search typed by the broker may be a tenant, contact or prospect name. It must not be carried into
 * prospect-safe mode: not in the search box, not in the link. (Typing a suite number or a floor while
 * the mode is on works as before; this is about what crosses the boundary.)
 */
export const canKeepSearch = (safe: boolean): boolean => !safe;

/**
 * Whether a prospect is shown the suite `key` names: it is a block of the prospect-safe plan, as of today (the
 * mode is always today). A selection that is not, such as an unpublished listing, is dropped as the switch turns
 * on; one that is (an available suite) stays chosen for the prospect (round 24: an unpublished Cedar Springs
 * listing's record id stayed in the address after the switch).
 */
export function shownToProspect(property: Property, key: string, today: ISODate): boolean {
  const floors = safeFloors(publishedFloors(deriveFloors(property, today, today), true), true);
  return floors.some((f) => f.segments.some((s) => s.key === key));
}
