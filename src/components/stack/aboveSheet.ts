import { useLayoutEffect } from 'react';

/** A vertical span on screen, in px from the top of the window. */
export interface Span {
  top: number;
  bottom: number;
}

/**
 * How far the page has to scroll (px; positive scrolls down) for `target` to stand whole inside `room`:
 * 0 when it already does. A target taller than the room is put with its top edge at the top of the room,
 * so what it starts with (a suite's name, a floor's number) is what shows.
 */
export function scrollToClear(target: Span, room: Span): number {
  if (target.bottom - target.top >= room.bottom - room.top) return target.top - room.top;
  if (target.bottom > room.bottom) return target.bottom - room.bottom;
  if (target.top < room.top) return target.top - room.top;
  return 0;
}

/** The air kept above the selection, and between it and the sheet's top edge, in px. */
const AIR_ABOVE = 8;
const AIR_BELOW = 16;

/**
 * Where the inspector is a bottom sheet (a tablet, a phone) it opens over the lower half of the plan,
 * which is often where the block that was just chosen stands. While the sheet is open for a selection
 * this keeps what `selector` matches (the chosen block, row or floor) whole in the part of the window
 * above the sheet:
 *
 *   - when the sheet opens or the selection changes, the page scrolls the selection clear of it
 *     (smoothly; at once under reduced motion);
 *   - when the sheet grows or shrinks (its handle, a rotated tablet) the page follows it, so the
 *     selection stays above the sheet's top edge;
 *   - when the plan under it changes size (the stack widens a focused floor, the web font arrives) it is
 *     put back, until the reader scrolls the page themselves: from then on only the sheet moves it.
 *
 * The page is given room below its last row equal to what the sheet covers (`--sp-sheet-cover`, which the
 * app's bottom padding reads), so the lowest floor can be scrolled clear as well. It runs as the change is
 * committed, in a layout effect, with the sheet already in the page; no timer is involved.
 */
export function useClearOfSheet(selector: string | null, open: boolean, reduceMotion: boolean): void {
  useLayoutEffect(() => {
    if (!open || !selector || typeof document === 'undefined') return;
    const sheet = document.querySelector<HTMLElement>('.sp-sheet');
    if (!sheet) return;
    const root = document.documentElement;
    const place = (smooth: boolean) => {
      const edge = sheet.getBoundingClientRect().top;
      root.style.setProperty('--sp-sheet-cover', `${Math.max(0, Math.round(window.innerHeight - edge))}px`);
      const target = document.querySelector(selector);
      if (!target) return;
      const r = target.getBoundingClientRect();
      const by = scrollToClear({ top: r.top, bottom: r.bottom }, { top: AIR_ABOVE, bottom: edge - AIR_BELOW });
      if (Math.abs(by) >= 1) window.scrollBy({ top: by, behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
    };
    place(true);

    // From the reader's own scroll on, a change in the plan's size no longer moves the page.
    let own = false;
    const mine = () => {
      own = true;
    };
    const keys = (e: KeyboardEvent) => {
      if (['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) own = true;
    };
    window.addEventListener('wheel', mine, { passive: true });
    window.addEventListener('touchmove', mine, { passive: true });
    window.addEventListener('keydown', keys);

    const observers: ResizeObserver[] = [];
    if (typeof ResizeObserver !== 'undefined') {
      // An observer reports once as it starts: that first report is the size already placed for.
      const watch = (el: Element | null, act: () => void) => {
        if (!el) return;
        let started = false;
        const ro = new ResizeObserver(() => {
          if (started) act();
          started = true;
        });
        ro.observe(el);
        observers.push(ro);
      };
      watch(sheet, () => place(false));
      watch(document.querySelector('.sp-stage'), () => {
        if (!own) place(false);
      });
    }
    return () => {
      for (const ro of observers) ro.disconnect();
      window.removeEventListener('wheel', mine);
      window.removeEventListener('touchmove', mine);
      window.removeEventListener('keydown', keys);
      root.style.removeProperty('--sp-sheet-cover');
    };
  }, [selector, open, reduceMotion]);
}

/** The element a selection stands for in the plan, as a selector: the chosen suite, else the open floor's row. */
export function selectionSelector(select: string | null, floor: string | null): string | null {
  const esc = (v: string) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(v) : v.replace(/["\\]/g, '\\$&'));
  if (select) return `.sp-stage [data-key="${esc(select)}"], .sp-stage [data-bar="tl-${esc(select)}"]`;
  if (floor) return `.sp-stage [data-row="${esc(floor)}"], .sp-stage .sp-pfloor.is-open, .sp-stage .sp-tl-row[data-floor="${esc(floor)}"]`;
  return null;
}
