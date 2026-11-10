import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '../../lib/useMedia';

export interface KpiRevealProps {
  /** Whether the strip is on screen. A change is animated (about 300 ms); the first render is not. */
  open: boolean;
  children: ReactNode;
}

const MS = 300;
const EASE = 'cubic-bezier(0.22, 0.8, 0.2, 1)';

/**
 * Shows or hides the KPI strip above the plan with a short reveal: the strip fades in from its top
 * edge while everything below it slides down to make room, and the reverse when it leaves.
 *
 * The layout is final from the first frame (the strip is at full height, or already out of the flow)
 * and only transforms, opacity and a clip animate. So anything that measures the page in the same
 * commit (the Building view fitting its model, its dock animation) measures where things will rest,
 * and no layout runs per frame. Nothing animates under `prefers-reduced-motion: reduce`.
 */
export function KpiReveal({ open, children }: KpiRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduce = usePrefersReducedMotion();
  // While leaving, the strip stays rendered (inert, out of the flow by a negative margin) until its animation ends.
  const [leaving, setLeaving] = useState(false);
  const [was, setWas] = useState(open);
  if (was !== open) {
    setWas(open);
    setLeaving(!open && !reduce);
  }
  const running = useRef<Animation[]>([]);
  const prev = useRef({ open, leaving });

  useLayoutEffect(() => {
    const el = ref.current;
    const before = prev.current;
    prev.current = { open, leaving };
    // Only a change of state animates: not the first render, and not a change of the motion preference.
    if (before.open === open && before.leaving === leaving) return;
    for (const a of running.current) a.cancel();
    running.current = [];
    if (!el) return;
    el.style.marginBottom = '';
    const entering = open && !before.open;
    const exiting = leaving && !before.leaving;
    if (reduce || !el.animate || (!entering && !exiting)) return;
    // What the strip adds to the page: its own height and the gap the app's column puts after it.
    const gap = parseFloat(getComputedStyle(el.parentElement ?? el).rowGap) || 0;
    const shift = el.offsetHeight + gap;
    if (shift <= 0) return;
    const below: Element[] = [];
    for (let s = el.nextElementSibling; s; s = s.nextElementSibling) below.push(s);
    const opts = { duration: MS, easing: EASE };
    // The clip leaves room for the tiles' shadows at the sides and opens (or closes) from the bottom edge.
    // Fully open it ends on the gap under the strip and no lower, so at every frame its bottom edge is
    // exactly where the top of what slides beneath it is (both have travelled the same share of
    // `shift`): the strip is never drawn over the toolbar it is pushing down, nor the toolbar over it.
    const shut = 'inset(-24px -40px 100% -40px)';
    const clear = `inset(-24px -40px -${gap}px -40px)`;
    if (entering) {
      running.current.push(el.animate([{ opacity: 0, clipPath: shut }, { opacity: 1, clipPath: clear }], opts));
      for (const s of below) running.current.push(s.animate([{ transform: `translateY(${-shift}px)` }, { transform: 'none' }], opts));
    } else {
      // Out of the flow at once, so the page below is already where it will rest.
      el.style.marginBottom = `${-shift}px`;
      const out = el.animate([{ opacity: 1, clipPath: clear }, { opacity: 0, clipPath: shut }], { ...opts, fill: 'forwards' });
      running.current.push(out);
      for (const s of below) running.current.push(s.animate([{ transform: `translateY(${shift}px)` }, { transform: 'none' }], opts));
      // The strip holds its last frame (transparent, out of the flow) until the render that hides it.
      out.onfinish = () => setLeaving(false);
    }
  }, [open, leaving, reduce]);

  const shown = open || leaving;
  return (
    <div ref={ref} className="sp-kpis-slot sp-no-print" hidden={!shown} inert={!open} aria-hidden={open ? undefined : true}>
      {shown && children}
    </div>
  );
}
