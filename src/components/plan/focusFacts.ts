import type { Segment } from '../../domain/derive';
import { toneFor, type LensId } from '../../domain/lenses';
import { segmentText, type SegmentTextOptions } from './segmentText';

/** The rate inside a fact ("Asking $30–$32/SF/yr FSG" → "$30–$32/SF/yr"), so the same rent is never shown twice. */
const rateKey = (t: string): string | null => /\$[\d.,–-]+\S*/.exec(t)?.[0] ?? null;

/**
 * Facts a focused floor adds to a suite, taken from the lenses that are not active:
 * the term, the rent, and the most advanced deal. One fact per kind, never one that is already
 * drawn, and nothing that only says a value is hidden.
 */
export function focusFacts(seg: Segment, lens: LensId, opts: Omit<SegmentTextOptions, 'lens'>): string[] {
  const own = segmentText(seg, { ...opts, lens });
  const drawn = `${own.sub} ${own.meta}`;
  const out: string[] = [];
  const add = (t: string | undefined) => {
    if (!t || /hidden|withheld|confidential/i.test(t)) return;
    const k = rateKey(t);
    const seen = k ? drawn.includes(k) || out.some((o) => o.includes(k)) : drawn.includes(t) || out.includes(t);
    if (!seen) out.push(t);
  };
  // Term: the status and expiry lenses already say it.
  if (lens !== 'status' && lens !== 'expiry') add(segmentText(seg, { ...opts, lens: 'status' }).meta);
  // Rent, unless the active lens already shows a rate for this space (asking rent on an availability).
  if (lens !== 'rent') add(segmentText(seg, { ...opts, lens: 'rent' }).meta);
  // Deal: only when a live deal exists (the deals lens falls back to the term for space without one).
  if (lens !== 'deals' && !opts.safe) {
    const tone = toneFor(seg, 'deals', false);
    if (tone.startsWith('deal-') && tone !== 'deal-none') add(segmentText(seg, { ...opts, lens: 'deals' }).meta);
  }
  return out;
}
