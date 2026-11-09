import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

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

/**
 * Anchored popover: Esc and outside click close it, focus moves inside on open and
 * returns to the trigger on close, Tab cycles within the panel.
 */
export function Popover({ open, onOpenChange, trigger, children, align = 'start', role = 'dialog', label, className = '', panelClassName = '' }: PopoverProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      onOpenChange(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, onOpenChange]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onOpenChange(false);
      return;
    }
    if (e.key === 'Tab' && panelRef.current) {
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className={`sp-pop ${className}`}>
      {trigger({ ref: triggerRef, onClick: () => onOpenChange(!open), 'aria-expanded': open, 'aria-haspopup': role, 'aria-controls': id })}
      {open && (
        <div
          id={id}
          ref={panelRef}
          role={role}
          aria-label={label}
          tabIndex={-1}
          className={`sp-pop__panel sp-pop__panel--${align} ${panelClassName}`}
          onKeyDown={onKeyDown}
        >
          {children}
        </div>
      )}
    </div>
  );
}
