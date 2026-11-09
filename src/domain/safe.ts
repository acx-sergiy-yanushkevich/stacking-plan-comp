import type { Availability, Deal, Lease } from './types';

/**
 * Prospect-safe helpers. Every place a tenant name, contact, rent or prospect
 * name could appear must route through one of these so `safe=1` hides them
 * consistently in views, tooltips, accessible names, exports and the title.
 */

export const TITLE = 'Stacking plan';
export const SAFE_TITLE = 'Stacking plan (prospect-safe)';

export const tenantLabel = (lease: Pick<Lease, 'tenant'>, safe: boolean): string => (safe ? 'Tenant' : lease.tenant);

export const contactLabel = (contact: string | undefined, safe: boolean): string | undefined => (safe ? undefined : contact);

export const prospectLabel = (deal: Pick<Deal, 'prospect'>, safe: boolean): string => (safe ? 'Prospect' : deal.prospect);

/**
 * Rents and prices show only outside prospect-safe mode and never for confidential
 * records. Availabilities have no Confidential__c, so only `safe` applies to them.
 */
export const rentVisible = (x: { confidential?: boolean } | Availability, safe: boolean): boolean =>
  !safe && !('confidential' in x && x.confidential);
