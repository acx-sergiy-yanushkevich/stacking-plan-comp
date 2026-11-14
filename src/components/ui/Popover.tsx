import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { focused, on, viewport } from '../../lib/host';
import { useLeaving } from './useLeaving';

export interface PopoverTriggerProps {
  ref: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
  'aria-expanded': boolean;
  'aria-haspopup': 'dialog' | 'menu';
  'aria-controls': string;
}

export interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  role?: 'dialog' | 'menu';
  label: string;
  className?: string;
  panelClassName?: string;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The air a panel keeps from the window's edge, px. */
const EDGE_AIR = 8;

/**
 * How far to move a panel that spans `left`..`right` so that it is inside a window `width` px wide with
 * its air (px; positive moves right, 0 when it already is). A panel wider than the window keeps its left
 * edge in view: that is where its text starts.
 */
export function shiftIntoWindow(left: number, right: number, width: number): number {
  if (left < EDGE_AIR || right - left > width - 2 * EDGE_AIR) return EDGE_AIR - left;
  if (right > width - EDGE_AIR) return width - EDGE_AIR - right;
  return 0;
}

/**
 * What Tab does in an open panel with `count` controls, focus on the `at`-th of them (-1: on the panel itself).
 *  - 'leave': a panel of text alone (the legend's ⓘ note) is a disclosure, not a place to stay. Tab or
 *    Shift+Tab closes it and moves on from its trigger, as if the trigger had been tabbed from (round 23: the
 *    note swallowed Tab, a non-modal dialog behaving as a modal one).
 *  - 'first' / 'last': a panel of controls keeps focus, cycling from its last control to its first and back.
 *  - null: the browser moves focus within the panel.
 */
export function tabMove(count: number, at: number, shift: boolean): 'leave' | 'first' | 'last' | null {
  if (count === 0) return 'leave';
  if (shift && at <= 0) return 'last';
  if (!shift && at === count - 1) return 'first';
  return null;
}

/**
 * Anchored popover: Esc and outside click close it, focus moves inside on open and
 * returns to the trigger on close. Tab cycles within a panel of controls and leaves a panel of text (`tabMove`).
 */
export function Popover({ open, onOpenChange, trigger, children, align = 'start', role = 'dialog', label, className = '', panelClassName = '' }: PopoverProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const wasOpen = useRef(false);
  /** Closed by Tab: focus has gone on from the trigger, and is not called back to it. */
  const tabbedOut = useRef(false);
  // Closed, the panel fades out before it is taken from the page (useLeaving). Focus has already gone back
  // to the trigger by then, and the leaving panel is inert.
  const { shown, leaving } = useLeaving(open);

  useEffect(() => {
    if (open) {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      if (!tabbedOut.current) triggerRef.current?.focus();
      tabbedOut.current = false;
    }
  }, [open]);

  // The panel hangs from its trigger's left or right edge. Where that would put part of it outside the
  // window (a phone: a 290 px menu under a button near the left edge), it is moved back in, whole.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const edge = align === 'end' ? 'right' : 'left';
    panel.style.removeProperty(edge);
    const r = panel.getBoundingClientRect();
    const shift = shiftIntoWindow(r.left, r.right, viewport().width);
    // `left` grows to the right, `right` to the left.
    if (shift) panel.style.setProperty(edge, `${align === 'end' ? -shift : shift}px`);
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      onOpenChange(false);
    };
    return on('pointerdown', onDown);
  }, [open, onOpenChange]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onOpenChange(false);
      return;
    }
    if (e.key === 'Tab' && panelRef.current) {
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      const move = tabMove(items.length, items.indexOf(focused() as HTMLElement), e.shiftKey);
      if (move === 'leave') {
        // Closed, never left open behind the focus (round 22). Focus is put on the trigger and the key is not
        // stopped, so the browser's own Tab or Shift+Tab moves on from there, in the page's order.
        tabbedOut.current = true;
        triggerRef.current?.focus();
        onOpenChange(false);
      } else if (move) {
        e.preventDefault();
        (move === 'first' ? items[0] : items[items.length - 1]).focus();
      }
    }
  };

  return (
    <div className={`sp-pop ${className}`}>
      {trigger({ ref: triggerRef, onClick: () => onOpenChange(!open), 'aria-expanded': open, 'aria-haspopup': role, 'aria-controls': id })}
      {shown && (
        <div
          id={id}
          ref={panelRef}
          role={role}
          aria-label={label}
          aria-hidden={leaving || undefined}
          inert={leaving || undefined}
          tabIndex={-1}
          className={`sp-pop__panel sp-pop__panel--${align} ${panelClassName} ${leaving ? 'is-leaving' : ''}`}
          onKeyDown={onKeyDown}
        >
          {children}
        </div>
      )}
    </div>
  );
}
