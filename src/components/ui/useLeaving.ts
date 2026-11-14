import { useEffect, useState } from 'react';
import { EXIT_MS } from '../../lib/motion';
import { usePrefersReducedMotion } from '../../lib/useMedia';

/** Whether something that can be dismissed is drawn, and whether it is on its way out. */
export interface Leaving {
  /** Draw it: it is open, or it is leaving. */
  shown: boolean;
  /** It has been closed and is fading out: it takes no pointer and is hidden from assistive technology. */
  leaving: boolean;
}

/**
 * The next state of a leave: closing starts one (never under reduced motion, where what is closed is gone
 * at once), and opening again ends it. Pure, so the rule is tested without a DOM.
 */
export function leaveStep(wasOpen: boolean, open: boolean, leaving: boolean, reduce: boolean): boolean {
  if (open) return false;
  if (wasOpen) return !reduce;
  return leaving;
}

/**
 * Keeps a popover, tooltip or toast in the page for `--sp-exit-ms` after it is closed, so it can fade out
 * (DESIGN.md §3.5: what is dismissed leaves, faster than it came). The caller draws while `shown` and adds
 * `is-leaving` while `leaving`. Closing is never delayed for the caller: `open` is already false, focus has
 * already moved, and the leaving copy cannot be clicked.
 */
export function useLeaving(open: boolean, ms: number = EXIT_MS): Leaving {
  const reduce = usePrefersReducedMotion();
  const [was, setWas] = useState(open);
  const [leaving, setLeaving] = useState(false);
  if (was !== open) {
    setWas(open);
    setLeaving(leaveStep(was, open, leaving, reduce));
  }
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(false), ms);
    return () => clearTimeout(t);
  }, [leaving, ms]);
  return { shown: open || leaving, leaving: !open && leaving };
}
