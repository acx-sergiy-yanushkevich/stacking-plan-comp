import type { SaleListing } from './types';
import { pct, usd, usd0 } from './format';

/** The building's sale listing in words: its state, the figures after it, and the two as one line. */
export interface ListingWords {
  /** "For sale", "Under contract"; to a prospect "Listed for sale" or "Under contract". */
  label: string;
  /** The owner's figures, in order: price, $/RSF, cap rate. None for a prospect. */
  facts: string[];
  /** "For sale $68,500,000 · $279.36/RSF · 6.4% cap", "Under contract · listed at $92,000,000 · …". */
  text: string;
}

/**
 * The sale listing as the header and the PDF both say it, so the two cannot disagree. The listing's status
 * leads: a building under contract is never called "for sale" (round 23: Cedar Springs, under contract, read
 * "For sale $92,000,000"). The owner gets the figures, the price then as what it was listed at; a prospect
 * gets the state alone, with no price, $/RSF or cap rate.
 */
export function listingWords(listing: SaleListing, leasable: number, safe: boolean): ListingWords {
  const active = listing.status === 'Active';
  const state = active ? 'For sale' : listing.status.charAt(0) + listing.status.slice(1).toLowerCase();
  if (safe) {
    const label = active ? 'Listed for sale' : state;
    return { label, facts: [], text: label };
  }
  const figures = [...(leasable > 0 ? [`${usd(listing.price / leasable)}/RSF`] : []), ...(listing.capRate !== null ? [`${pct(listing.capRate)} cap`] : [])];
  if (active) {
    const facts = [usd0(listing.price), ...figures];
    return { label: state, facts, text: `${state} ${facts.join(' · ')}` };
  }
  const facts = [`listed at ${usd0(listing.price)}`, ...figures];
  return { label: state, facts, text: [state, ...facts].join(' · ') };
}
