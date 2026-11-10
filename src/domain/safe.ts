import type { FloorView, Segment } from './derive';
import type { Availability, Deal, Lease } from './types';

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
 *   holdover and month-to-month                  canShowTenantRisk · termHidden
 *   deals: stage, prospect, size, counts         canShowDeals · visibleDeals · prospectLabel
 *   open inquiries and where they came from      canShowInquiries · visibleInquiries
 *   data issues, counts included                 canShowIssues · visibleIssues
 *   brokers and record owners                    canShowBrokers · brokerLabel
 *   last touch, change history, verified stamps  canShowActivity
 *   quiet (unpublished) listings                 listingVisible · marketedFor · safeFloors
 *   whether a listing is quiet or published      canShowListingStatus
 *   record actions (they name the record)        canShowRecordActions
 */

export const TITLE = 'Stacking plan';
export const SAFE_TITLE = 'Stacking plan (prospect-safe)';

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

/** Prospect-safe: a holdover or month-to-month term is withheld entirely (no end date, no months left), so neither stands out. */
export const termHidden = (kind: string, safe: boolean): boolean => !canShowTenantRisk(safe) && (kind === 'holdover' || kind === 'mtm');

/** Deal activity: stage, prospect, size, updated date, the pipeline and every deal count. */
export const canShowDeals = (safe: boolean): boolean => !safe;

/** Other prospects' requirements: size, date needed and lead source. */
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

/**
 * The floors as a prospect may see them: quiet marketed-for-later listings are removed from the
 * occupied suites that carry them, so anything computed from the result (coming supply, finder
 * options, timeline bars) cannot mention them. Outside prospect-safe mode the input is returned as is.
 */
export function safeFloors(floors: FloorView[], safe: boolean): FloorView[] {
  if (!safe) return floors;
  return floors.map((f) => {
    if (f.segments.every((s) => !s.marketed || listingVisible(s.marketed, safe))) return f;
    return { ...f, segments: f.segments.map((s) => (s.marketed && !listingVisible(s.marketed, safe) ? { ...s, marketed: undefined } : s)) };
  });
}
