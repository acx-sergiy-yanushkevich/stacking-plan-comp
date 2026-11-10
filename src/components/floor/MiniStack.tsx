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

/** Thin vertical floor picker: one tinted row per floor, the current floor outlined. */
export function MiniStack({ floors, currentId, onPick, onPreview }: MiniStackProps) {
  return (
    <nav className="sp-mini" aria-label="Floors">
      <ol className="sp-mini__list">
        {floors.map((f) => {
          const share = f.leasable > 0 ? f.leased / f.leasable : 0;
          const current = f.floor.id === currentId;
          return (
            <li key={f.floor.id}>
              <button
                type="button"
                className={`sp-mini__row ${current ? 'is-current' : ''} ${share > 0.6 ? 'is-strong' : ''}`}
                aria-label={`${f.floor.sequence} ${pct(share)} leased, ${f.floor.name}`}
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
