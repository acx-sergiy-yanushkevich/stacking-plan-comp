import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';

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
}

/** Non-modal bottom sheet for phones. The handle toggles between half and full height. */
export function Sheet({ open, onClose, title, children, snap = 'half', hideHeader, modeless }: SheetProps) {
  const [full, setFull] = useState(snap === 'full');
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (open) setFull(snap === 'full');
  }, [open, snap]);
  useEffect(() => {
    if (!open) return;
    const first = ref.current?.querySelector<HTMLElement>('.sp-sheet__body button, .sp-sheet__body [tabindex="0"], .sp-sheet__handle');
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
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} role="dialog" aria-modal={modeless ? undefined : 'true'} aria-label={typeof title === 'string' ? title : 'Details'} className={`sp-sheet ${full ? 'sp-sheet--full' : ''}`}>
      <button type="button" className="sp-sheet__handle" aria-label={full ? 'Collapse panel' : 'Expand panel'} aria-expanded={full} onClick={() => setFull((f) => !f)}>
        <span />
      </button>
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
