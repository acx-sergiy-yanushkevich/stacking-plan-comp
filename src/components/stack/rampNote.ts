import type { LensId } from '../../domain/lenses';
import { canShowDeals, canShowLeaseTerm } from '../../domain/safe';

/**
 * How to read a lens's colour ramp, in a few words for the legend.
 *
 * The ramps are built to stand out from the card they are drawn on, so they run from light to dark at
 * night and from dark to light by day. The rule a reader needs is the one that holds in both: the
 * stronger a colour stands against the card, the sooner the lease ends (or the higher the rent, or the
 * further the deal). The legend lists the steps in the same order in both themes; this says which end
 * is which, so a night screen and a daytime print of the same plan are read the same way.
 *
 * Null when the lens has no ramp to explain: the status lens, and any ramp prospect-safe mode withholds.
 */
export function rampNote(lens: LensId, safe: boolean): string | null {
  if (lens === 'expiry') return canShowLeaseTerm(safe) ? 'Stronger color = sooner expiry.' : null;
  if (lens === 'rent') return 'Stronger blue = higher rent.';
  if (lens === 'deals') return canShowDeals(safe) ? 'Stronger orange = deal further along.' : null;
  return null;
}
