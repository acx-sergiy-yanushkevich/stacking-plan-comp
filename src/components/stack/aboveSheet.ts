import { useLayoutEffect, useState } from 'react';
import { cancelFrame, find, findAll, hasPage, on, requestFrame, scrollBy, setRootStyle, viewport } from '../../lib/host';

/** A vertical span on screen, in px from the top of the window. */
export interface Span {
  top: number;
  bottom: number;
}

/**
 * How far the page has to scroll (px; positive scrolls down) for `target` to stand whole inside `room`:
 * 0 when it already does. A target taller than the room is put with its top edge at the top of the room,
 * so what it starts with (a suite's name, a floor's number) is what shows. The page scrolls by whole
 * pixels, so the distance is too, rounded the way that leaves the edge that mattered inside the room.
 */
export function scrollToClear(target: Span, room: Span): number {
  if (target.bottom - target.top >= room.bottom - room.top) return Math.floor(target.top - room.top);
  if (target.bottom > room.bottom) return Math.ceil(target.bottom - room.bottom);
  if (target.top < room.top) return Math.floor(target.top - room.top);
  return 0;
}

/**
 * Where the selection stands in the page and the sheet in the window: the selection's top measured from
 * the top of the page (so scrolling does not change it), its height, the sheet's top edge and the window's
 * height, px. When any of these changes, the layout has moved under the selection and it is placed again.
 */
export interface Layout {
  at: number;
  height: number;
  edge: number;
  viewport: number;
}

/** Whether two layouts are the same, to half a pixel. */
export function sameLayout(a: Layout, b: Layout): boolean {
  return Math.abs(a.at - b.at) < 0.5 && Math.abs(a.height - b.height) < 0.5 && Math.abs(a.edge - b.edge) < 0.5 && Math.abs(a.viewport - b.viewport) < 0.5;
}

/** The air kept above the selection, and between it and the sheet's top edge, in px. */
export const AIR_ABOVE = 8;
export const AIR_BELOW = 16;

/**
 * The strip at the top of the window a selection `height` px tall needs to stand whole with its air: the
 * sheet is never grown into it (ui/sheetHeight.ts), so however far the sheet is expanded there is a
 * scroll position that shows the complete block above the sheet's top edge. It has a pixel to spare,
 * because the page scrolls by whole pixels and a row may stand at a fraction of one.
 */
export function roomToKeep(height: number): number {
  return AIR_ABOVE + Math.ceil(height) + 1 + AIR_BELOW;
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
 *     put back, until the reader scrolls the page themselves: from then on only the sheet moves it;
 *   - when the window changes size (a rotated phone, a desktop window narrowed to a phone's width) the
 *     views lay themselves out again over a few renders, the header and the toolbar get shorter and the
 *     selection is drawn by another element (a stack block becomes a phone row). The selection is found
 *     again, and placed again on every frame in which the layout has moved, until it has stood still for a
 *     few frames. The same happens as the sheet first opens, because a sheet that opens with a change of
 *     width (round 17: desktop to phone) opens while the rest of the page is still being laid out.
 *
 * The page is given room below its last row equal to what the sheet covers (`--sp-sheet-cover`, which the
 * app's bottom padding reads), so the lowest floor can be scrolled clear as well. It runs as the change is
 * committed, in a layout effect, with the sheet already in the page; the settling after it runs frame by
 * frame, and no timer is involved.
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
    /** The selection as it is drawn now: the first match that is laid out (another view may have left one that is not). */
    const current = () => findAll<Element>(selector).find((el) => el.getBoundingClientRect().height > 0) ?? null;
    const layoutOf = (target: Element): Layout => {
      const r = target.getBoundingClientRect();
      return { at: r.top - (find('.sp-app')?.getBoundingClientRect().top ?? 0), height: r.height, edge: sheet.getBoundingClientRect().top, viewport: viewport().height };
    };
    let placed: Layout | null = null;
    /** Note how much of the window the sheet covers and how much the selection needs; `move` also scrolls the selection clear. */
    const place = (move: boolean, smooth: boolean) => {
      const edge = sheet.getBoundingClientRect().top;
      setRootStyle('--sp-sheet-cover', `${Math.max(0, Math.round(viewport().height - edge))}px`);
      const target = current();
      if (!target) return;
      follow(target);
      const r = target.getBoundingClientRect();
      // The room it needs is that of the row as it is drawn now, not as it was: a phone row is half a stack block's height.
      setKeep(roomToKeep(r.height));
      placed = layoutOf(target);
      if (!move) return;
      const by = scrollToClear({ top: r.top, bottom: r.bottom }, { top: AIR_ABOVE, bottom: edge - AIR_BELOW });
      if (Math.abs(by) >= 1) scrollBy(by, smooth && !reduceMotion);
    };

    // From the reader's own scroll on, a change in the plan's size no longer moves the page. A drag on the
    // sheet's handle, or a scroll inside the sheet, is not a scroll of the page.
    let own = false;
    const inSheet = (e: Event) => !!e.target && sheet.contains(e.target as unknown as Element);
    const mine = (e: Event) => {
      if (!inSheet(e)) own = true;
    };
    const keys = (e: KeyboardEvent) => {
      if (['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp', ' '].includes(e.key) && !inSheet(e)) own = true;
    };

    // Frame by frame while the layout settles: placed again whenever it has moved, until it has stood still for a few frames.
    let frame: number | null = null;
    let left = 0;
    let still = 0;
    const tick = () => {
      frame = null;
      const target = current();
      if (target && (!placed || !sameLayout(placed, layoutOf(target)))) {
        place(true, false);
        still = 0;
      } else still++;
      if (--left > 0 && still < 12) frame = requestFrame(tick);
    };
    const settle = () => {
      left = 90;
      still = 0;
      if (frame === null) frame = requestFrame(tick);
    };

    const observers: ResizeObserver[] = [];
    // The selection's own element, watched for its size; when another element comes to draw it, that one is.
    let follow = (_target: Element) => {};
    if (typeof ResizeObserver !== 'undefined') {
      let followed: Element | null = null;
      let first = true;
      const targetSizes = new ResizeObserver(() => {
        // The first report on the element first placed for is the size already placed for; on one that replaced it, it is news.
        if (first) first = false;
        else place(!own, false);
      });
      observers.push(targetSizes);
      follow = (target) => {
        if (target === followed) return;
        if (followed) first = false;
        followed = target;
        targetSizes.disconnect();
        targetSizes.observe(target);
      };
    }
    place(true, true);
    settle();
    const stops = [
      on('wheel', mine, { passive: true }),
      on('touchmove', mine, { passive: true }),
      on('keydown', keys),
      // A new window size lays the page out again: the selection is put back above the sheet whoever scrolled last.
      on('resize', () => {
        place(true, false);
        settle();
      }),
    ];

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
      cancelFrame(frame);
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
