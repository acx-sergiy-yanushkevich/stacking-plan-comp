import type { LensId } from '../../domain/lenses';
import { canShowDeals, canShowLeaseTerm } from '../../domain/safe';

/**
 * How to read a lens's colour ramp, in a few words for the legend.
 *
 * The ramps are built to stand out from the card they are drawn on, so they run from light to dark at
 * night and from dark to light by day: no word about the colour itself ("stronger", "darker") holds in
 * both (round 19: "stronger blue = higher rent" sat beside a near-white $38+ swatch at night). The
 * legend lists the steps in the same order in both themes, so the note says what that order is.
 *
 * Null when the lens has no ramp to explain: the status lens, and any ramp prospect-safe mode withholds.
 */
export function rampNote(lens: LensId, safe: boolean): string | null {
  if (lens === 'expiry') return canShowLeaseTerm(safe) ? 'Steps run from the soonest expiry to the latest.' : null;
  if (lens === 'rent') return 'Steps run from the lowest gross rent to the highest.';
  if (lens === 'deals') return canShowDeals(safe) ? 'Steps run from the deal furthest along to the earliest.' : null;
  return null;
}
