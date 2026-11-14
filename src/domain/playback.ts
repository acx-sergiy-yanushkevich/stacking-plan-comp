import { addMonths } from './dates';
import type { ISODate } from './types';

/**
 * Play through time: the as-of date steps forward a quarter at a time, from where it stands to five years
 * out, so the building is seen emptying and filling as its leases roll. Each step is an as-of date like
 * any other: every figure is the figure for that date, and nothing between two dates is ever drawn.
 */

/** One step, in months. A quarter: five years pass in twenty steps. */
export const PLAY_STEP_MONTHS = 3;
/** Where a play ends, in months after today: the last of the as-of presets ("+5 yr"). */
export const PLAY_END_MONTHS = 60;

/** The date a play ends on. */
export const playEnd = (today: ISODate): ISODate => addMonths(today, PLAY_END_MONTHS);

/** Where a play starts: the date the plan is at, or today when that is in the past or has no step left before the end. */
export function playStart(asOf: ISODate, today: ISODate): ISODate {
  return asOf < today || asOf >= playEnd(today) ? today : asOf;
}

/** The date after `asOf` in a play, never past the end; null when the play is over. */
export function playNext(asOf: ISODate, today: ISODate): ISODate | null {
  const end = playEnd(today);
  if (asOf >= end) return null;
  const next = addMonths(asOf, PLAY_STEP_MONTHS);
  return next > end ? end : next;
}
