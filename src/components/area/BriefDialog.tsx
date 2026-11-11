import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import type { Area, Property } from '../../domain/types';
import { Button } from '../ui';
import { LocationBrief } from './LocationBrief';
import './area.css';

export interface BriefDialogProps {
  property: Property;
  area: Area;
  /** Back to the Area panel the brief was opened from. */
  onClose: () => void;
}

const TITLE_ID = 'sp-brief-title';

/**
 * The location brief over the page, as a modal `<dialog>`: the browser keeps focus inside it and the
 * page behind it out of reach. Escape, the close button or a click on the backdrop closes it.
 */
export function BriefDialog({ property, area, onClose }: BriefDialogProps) {
  const ref = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // The title, not the close button, takes focus: the brief is read from its top (WAI-ARIA APG, dialog).
    dialog?.querySelector<HTMLElement>(`#${TITLE_ID}`)?.focus();
    return () => dialog?.close();
  }, []);

  // Escape belongs to the dialog: the page's own Escape (clear the filter, close a floor) must not hear it.
  // The dialog's `cancel` event, which Escape fires, closes it.
  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'Escape') e.stopPropagation();
  };
  const onBackdrop = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <dialog
      ref={ref}
      className="sp-brief-dialog sp-no-print"
      aria-labelledby={TITLE_ID}
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={onBackdrop}
    >
      <div className="sp-brief-dialog__body">
        <Button className="sp-brief-dialog__close" variant="ghost" size="sm" icon="close" iconOnly aria-label="Close" title="Close (Esc)" onClick={onClose} />
        <LocationBrief property={property} area={area} titleId={TITLE_ID} />
      </div>
    </dialog>
  );
}
