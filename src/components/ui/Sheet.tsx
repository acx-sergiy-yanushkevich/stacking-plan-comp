import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { canExpandSheet, dragSheetHeight, expandedSheetHeight, isSheetDrag, snapSheet } from './sheetHeight';
import { focused, on, viewport as hostViewport } from '../../lib/host';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Initial snap point. */
  snap?: 'half' | 'full';
  /** The content brings its own title row and close button. */
  hideHeader?: boolean;
  /** Non-modal: the page behind stays reachable (tool panels on phones). */
  modeless?: boolean;
  /**
   * The strip at the top of the window the sheet must leave uncovered, px: what it was opened for (the
   * chosen suite, bar or floor) with the air round it. The expanded sheet stops short of it.
   */
  keepClear?: number | null;
}

/** What the sheet's content needs to show whole, px: the sheet's own height with the scrolling part at its content's height. */
function contentHeight(sheet: HTMLElement): number {
  const scroller = sheet.querySelector<HTMLElement>('[data-sheet-scroll]') ?? sheet.querySelector<HTMLElement>('.sp-sheet__body');
  const own = sheet.getBoundingClientRect().height;
  if (!scroller) return own;
  let inner = scroller.scrollHeight;
  if (inner <= scroller.clientHeight) {
    // Shorter than the room it has: the span of what is laid out in it (offsets, so a panel that is fading in at an offset measures the same).
    const shown = Array.from(scroller.children).filter((c): c is HTMLElement => c instanceof HTMLElement && c.offsetParent !== null);
    const style = getComputedStyle(scroller);
    const pad = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    inner = shown.length ? shown[shown.length - 1].offsetTop + shown[shown.length - 1].offsetHeight - shown[0].offsetTop + pad : scroller.clientHeight;
  }
  return own - scroller.clientHeight + inner;
}

/**
 * Non-modal bottom sheet for phones and tablets. The handle toggles between the half snap and the expanded
 * height, which is the height of the content: never more than 92% of the window, and never so much that
 * the selection the sheet was opened for is covered (`keepClear`). When the half snap already shows
 * everything, or there is no room to grow into, the handle is a plain grab bar and not a control.
 *
 * The handle can also be dragged, with a finger or a mouse: the sheet follows the pointer between the two
 * heights and, let go, settles at the nearer one, or the way it was flicked. A press that barely moves is a
 * tap and toggles, as a click or Enter does.
 */
export function Sheet({ open, onClose, title, children, snap = 'half', hideHeader, modeless, keepClear = null }: SheetProps) {
  const [full, setFull] = useState(snap === 'full');
  const [content, setContent] = useState<number | null>(null);
  const [viewport, setViewport] = useState(() => hostViewport().height);
  const [labelId, setLabelId] = useState<string | null>(null);
  // The dialog takes its name from the panel's own heading ("Floor 12 · Suite 1210"), when there is one.
  useEffect(() => {
    if (!open || !ref.current) return;
    const h = ref.current.querySelector<HTMLElement>('h1, h2, h3');
    if (h) {
      if (!h.id) h.id = 'sp-sheet-title';
      setLabelId(h.id);
    } else setLabelId(null);
  }, [open, children]);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (open) setFull(snap === 'full');
  }, [open, snap]);
  useEffect(() => {
    if (!open) return;
    const first = ref.current?.querySelector<HTMLElement>('.sp-sheet__body button, .sp-sheet__body [tabindex="0"], button.sp-sheet__handle');
    first?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current && !modeless) {
        const items = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && focused() === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && focused() === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    return on('keydown', onKey);
  }, [open, onClose]);
  // The content's height is measured as it is laid out, and again whenever it changes: another suite's
  // panel, a section that opens, the web font arriving.
  useLayoutEffect(() => {
    const sheet = ref.current;
    if (!open || !sheet) return;
    const measure = () => {
      const next = contentHeight(sheet);
      setContent((was) => (was !== null && Math.abs(was - next) < 0.5 ? was : next));
    };
    const onResize = () => {
      setViewport(hostViewport().height);
      measure();
    };
    onResize();
    const stopResize = on('resize', onResize);
    if (typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined') return stopResize;
    const sizes = new ResizeObserver(measure);
    const watch = () => {
      sizes.disconnect();
      const scroller = sheet.querySelector<HTMLElement>('[data-sheet-scroll]') ?? sheet.querySelector<HTMLElement>('.sp-sheet__body');
      if (!scroller) return;
      sizes.observe(scroller);
      for (const child of Array.from(scroller.children)) sizes.observe(child);
    };
    watch();
    // A panel swaps the elements it is made of: watch the new ones.
    const swaps = new MutationObserver(() => {
      watch();
      measure();
    });
    swaps.observe(sheet, { childList: true, subtree: true });
    return () => {
      stopResize();
      sizes.disconnect();
      swaps.disconnect();
    };
  }, [open]);
  const measured = { viewport, content, keepClear };
  const canExpand = viewport > 0 && canExpandSheet(measured);
  const expanded = full && canExpand;
  // A handle that held the keyboard and stops being a control hands it to the panel, not to the page.
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const handleHadFocus = useRef(false);
  handleHadFocus.current = !!handleRef.current && focused() === handleRef.current;
  useLayoutEffect(() => {
    if (canExpand || !handleHadFocus.current) return;
    ref.current?.querySelector<HTMLElement>('.sp-sheet__body button:not([disabled]), .sp-sheet__body [tabindex="0"]')?.focus({ preventScroll: true });
  }, [canExpand]);
  // A drag on the handle: where it started, the sheet's height then, and the last two samples, for the speed of the release.
  const drag = useRef<{ id: number; y: number; from: number; moved: boolean; last: { y: number; t: number }; prev: { y: number; t: number } } | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  // The click a browser may send after a drag's release is not a tap. A touch drag sends none, so it is the
  // time of the release that is kept: a click straight after it is dropped, and a later one (Enter) is not.
  const releasedAt = useRef(-Infinity);
  const onHandleDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!ref.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    // The pointer is the handle's until it lets go, so the drag goes on outside the 40 px bar and never reaches the page.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const sample = { y: e.clientY, t: e.timeStamp };
    drag.current = { id: e.pointerId, y: e.clientY, from: ref.current.getBoundingClientRect().height, moved: false, last: sample, prev: sample };
  };
  const onHandleMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.y;
    if (!d.moved && !isSheetDrag(dy)) return;
    d.moved = true;
    d.prev = d.last;
    d.last = { y: e.clientY, t: e.timeStamp };
    setDragHeight(dragSheetHeight(d.from, dy, measured));
  };
  const onHandleUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    releasedAt.current = e.timeStamp;
    const dt = d.last.t - d.prev.t;
    // A pause before letting go is no flick: the speed is that of the last movement, and nothing if that was long ago.
    const velocity = dt > 0 && e.timeStamp - d.last.t < 100 ? (d.last.y - d.prev.y) / dt : 0;
    const height = dragSheetHeight(d.from, e.clientY - d.y, measured);
    setFull(snapSheet(height, velocity, measured) === 'full');
    setDragHeight(null);
  };
  const onHandleCancel = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    drag.current = null;
    setDragHeight(null);
  };
  const dragging = dragHeight !== null && canExpand;
  if (!open) return null;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal={modeless ? undefined : 'true'}
      aria-labelledby={labelId ?? undefined}
      aria-label={labelId ? undefined : typeof title === 'string' ? title : 'Details'}
      className={`sp-sheet ${expanded ? 'sp-sheet--full' : ''} ${dragging ? 'sp-sheet--dragging' : ''}`}
      style={dragging ? { height: dragHeight } : expanded ? { height: expandedSheetHeight(measured) } : undefined}
    >
      {canExpand ? (
        <button
          ref={handleRef}
          type="button"
          className="sp-sheet__handle"
          aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
          aria-expanded={expanded}
          onClick={(e) => {
            if (e.timeStamp - releasedAt.current > 300) setFull(!expanded);
          }}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleCancel}
        >
          <span />
        </button>
      ) : (
        <div className="sp-sheet__handle" aria-hidden="true">
          <span />
        </div>
      )}
      {!hideHeader && (
        <div className="sp-sheet__head">
          <div className="sp-sheet__title">{title}</div>
          <Button variant="ghost" size="sm" icon="close" iconOnly aria-label="Close panel" onClick={onClose} />
        </div>
      )}
      <div className="sp-sheet__body">{children}</div>
    </div>
  );
}
