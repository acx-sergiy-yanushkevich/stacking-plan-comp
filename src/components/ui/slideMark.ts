import { useLayoutEffect, useRef, type RefObject } from 'react';
import { computedStyle } from '../../lib/host';
import { MOVE_CURVE, MOVE_MS } from '../../lib/motion';
import { usePrefersReducedMotion } from '../../lib/useMedia';

/** A mark's box along its row, in px from the row's start. */
export interface MarkBox {
  left: number;
  width: number;
}

/**
 * The frames that slide a choice's mark (the View switch's pill, the Color by underline) from where the old
 * choice's mark stood onto the new one: it starts on the old mark, as wide as it, and ends at rest. Null
 * when there is nothing to move, or the new mark has no width yet.
 */
export function markKeyframes(from: MarkBox, to: MarkBox): Keyframe[] | null {
  if (to.width <= 0 || (from.left === to.left && from.width === to.width)) return null;
  const dx = from.left - to.left;
  const s = Math.round((from.width / to.width) * 1000) / 1000;
  return [
    { transform: `translateX(${dx}px) scaleX(${s})`, transformOrigin: '0 50%' },
    { transform: 'none', transformOrigin: '0 50%' },
  ];
}

/** Where the mark drawn by `el`'s pseudo-element stands: the element's place plus the mark's own offset and width. */
function markBox(el: HTMLElement, pseudo: string): MarkBox {
  const cs = computedStyle(el, pseudo);
  const left = parseFloat(cs?.getPropertyValue('left') ?? '') || 0;
  const width = parseFloat(cs?.getPropertyValue('width') ?? '');
  return { left: el.offsetLeft + left, width: Number.isFinite(width) ? width : el.offsetWidth };
}

/**
 * When the active choice in `container` changes, its mark (drawn by `pseudoElement`) slides over from the
 * choice that was active (DESIGN.md §3.5). The choices stay where they are: only the mark moves, so the
 * labels never shift. Nothing moves under reduced motion, on the first render, or where the browser cannot
 * animate a pseudo-element.
 */
export function useSlideMark(container: RefObject<HTMLElement | null>, selector: string, activeKey: string | null, pseudoElement: '::before' | '::after'): void {
  const reduce = usePrefersReducedMotion();
  const was = useRef<{ key: string | null; el: HTMLElement | null }>({ key: activeKey, el: null });
  useLayoutEffect(() => {
    const el = container.current?.querySelector<HTMLElement>(selector) ?? null;
    const before = was.current;
    was.current = { key: activeKey, el };
    const old = before.el;
    if (reduce || !el || !old || !old.isConnected || old === el || before.key === activeKey || typeof el.animate !== 'function') return;
    // The old choice is measured now, not when it was chosen: the row may have changed width since.
    const frames = markKeyframes(markBox(old, pseudoElement), markBox(el, pseudoElement));
    if (!frames) return;
    const slide = el.animate(frames, { duration: MOVE_MS, easing: MOVE_CURVE, pseudoElement });
    return () => slide.cancel();
    // `selector` and `pseudoElement` are fixed per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, reduce]);
}
