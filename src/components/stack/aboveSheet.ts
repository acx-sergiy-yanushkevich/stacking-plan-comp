import { useLayoutEffect, useState } from 'react';
import { find, hasPage, on, scrollBy, setRootStyle, viewport } from '../../lib/host';

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
export const AIR_ABOVE = 8;
export const AIR_BELOW = 16;

/**
 * The strip at the top of the window a selection `height` px tall needs to stand whole with its air: the
 * sheet is never grown into it (ui/sheetHeight.ts), so however far the sheet is expanded there is a
 * scroll position that shows the complete block above the sheet's top edge.
 */
export function roomToKeep(height: number): number {
  return AIR_ABOVE + Math.ceil(height) + AIR_BELOW;
}

/**
 * Where the inspector is a bottom sheet (a tablet, a phone) it opens over the lower half of the plan,
 * which is often where the block that was just chosen stands. While the sheet is open for a selection
 * this keeps what `selector` matches (the chosen block, row or floor) whole in the part of the window
 * above the sheet:
 *
 *   - when the sheet opens or the selection changes, the page scrolls the selection clear of it
 *     (smoothly; at once under reduced motion);
 *   - when the sheet grows or shrinks (its handle, a rotated tablet) the page follows it frame by frame,
 *     so the selection stays above the sheet's top edge at every height on the way;
 *   - the sheet is told how much of the window the selection needs (the value returned: `roomToKeep` of
 *     its height, or null when there is nothing selected), and stops growing short of it;
 *   - when the plan under it changes size (the stack widens a focused floor, the web font arrives) it is
 *     put back, until the reader scrolls the page themselves: from then on only the sheet moves it.
 *
 * The page is given room below its last row equal to what the sheet covers (`--sp-sheet-cover`, which the
 * app's bottom padding reads), so the lowest floor can be scrolled clear as well. It runs as the change is
 * committed, in a layout effect, with the sheet already in the page; no timer is involved.
 */
export function useClearOfSheet(selector: string | null, open: boolean, reduceMotion: boolean): number | null {
  const [keep, setKeep] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!open || !selector || !hasPage()) {
      setKeep(null);
      return;
    }
    const sheet = find('.sp-sheet');
    if (!sheet) return;
    /** Note how much of the window the sheet covers and how much the selection needs; `move` also scrolls the selection clear. */
    const place = (move: boolean, smooth: boolean) => {
      const edge = sheet.getBoundingClientRect().top;
      setRootStyle('--sp-sheet-cover', `${Math.max(0, Math.round(viewport().height - edge))}px`);
      const target = find<Element>(selector);
      if (!target) return;
      const r = target.getBoundingClientRect();
      setKeep(roomToKeep(r.height));
      if (!move) return;
      const by = scrollToClear({ top: r.top, bottom: r.bottom }, { top: AIR_ABOVE, bottom: edge - AIR_BELOW });
      if (Math.abs(by) >= 1) scrollBy(by, smooth && !reduceMotion);
    };
    place(true, true);

    // From the reader's own scroll on, a change in the plan's size no longer moves the page.
    let own = false;
    const mine = () => {
      own = true;
    };
    const keys = (e: KeyboardEvent) => {
      if (['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) own = true;
    };
    // Keys are heard on the document, which every key the reader scrolls with reaches before the window.
    const stops = [on('wheel', mine, { passive: true }), on('touchmove', mine, { passive: true }), on('keydown', keys)];

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
      watch(sheet, () => place(true, false));
      // The plan changing size always re-measures the selection (the sheet's cap depends on it); it moves the page only until the reader has.
      watch(find('.sp-stage'), () => place(!own, false));
    }
    // The last frame of the sheet's height transition, measured once more when it is over.
    const settled = (e: TransitionEvent) => {
      if (e.target === sheet && e.propertyName === 'height') place(true, false);
    };
    sheet.addEventListener('transitionend', settled);
    return () => {
      for (const ro of observers) ro.disconnect();
      sheet.removeEventListener('transitionend', settled);
      for (const stop of stops) stop();
      setRootStyle('--sp-sheet-cover', null);
    };
  }, [selector, open, reduceMotion]);
  return keep;
}

/** The element a selection stands for in the plan, as a selector: the chosen suite, else the open floor's row. */
export function selectionSelector(select: string | null, floor: string | null): string | null {
  const esc = (v: string) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(v) : v.replace(/["\\]/g, '\\$&'));
  if (select) return `.sp-stage [data-key="${esc(select)}"], .sp-stage [data-bar="tl-${esc(select)}"]`;
  if (floor) return `.sp-stage [data-row="${esc(floor)}"], .sp-stage .sp-pfloor.is-open, .sp-stage .sp-tl-row[data-floor="${esc(floor)}"]`;
  return null;
}
