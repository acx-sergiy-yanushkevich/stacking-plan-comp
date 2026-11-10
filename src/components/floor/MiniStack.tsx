import { useRef, type KeyboardEvent } from 'react';
import type { FloorView } from '../../domain/derive';
import { pct } from '../../domain/format';

export interface MiniStackProps {
  /** Top floor first (as `PlanModel.floors`). */
  floors: FloorView[];
  currentId: string;
  onPick: (floorId: string) => void;
  /** Pointing at or focusing a row previews that floor; null when it ends. */
  onPreview?: (floorId: string | null) => void;
}

/**
 * Thin vertical floor picker: one tinted row per floor, the current floor outlined. It is the
 * keyboard equivalent of the building model, so it is one tab stop: ↑ ↓ move between floors (and
 * preview each), Home and End jump to the top and bottom, Enter or Space pins.
 */
export function MiniStack({ floors, currentId, onPick, onPreview }: MiniStackProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const stop = Math.max(0, floors.findIndex((f) => f.floor.id === currentId));
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const to = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? floors.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    refs.current[Math.min(floors.length - 1, Math.max(0, to))]?.focus();
  };
  return (
    <nav className="sp-mini" aria-label="Floors">
      <ol className="sp-mini__list">
        {floors.map((f, i) => {
          const share = f.leasable > 0 ? f.leased / f.leasable : 0;
          const current = f.floor.id === currentId;
          return (
            <li key={f.floor.id}>
              <button
                type="button"
                ref={(el) => {
                  refs.current[i] = el;
                }}
                tabIndex={i === stop ? 0 : -1}
                onKeyDown={(e) => onKey(e, i)}
                className={`sp-mini__row ${current ? 'is-current' : ''} ${share > 0.6 ? 'is-strong' : ''}`}
                aria-label={`${f.floor.name}, ${pct(share)} leased`}
                aria-current={current ? 'true' : undefined}
                title={`${f.floor.name} · ${pct(share)} leased`}
                onClick={() => onPick(f.floor.id)}
                onPointerEnter={onPreview && (() => onPreview(f.floor.id))}
                onPointerLeave={onPreview && (() => onPreview(null))}
                onFocus={onPreview && (() => onPreview(f.floor.id))}
                onBlur={onPreview && (() => onPreview(null))}
              >
                <span className="sp-mini__fill" style={{ height: `${Math.max(8, Math.round(share * 100))}%`, top: "auto" }} aria-hidden="true" />
                <span className="sp-mini__num">{`${f.floor.sequence} `}</span>
                <span className="sp-mini__pct">{`${pct(share)} `}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
