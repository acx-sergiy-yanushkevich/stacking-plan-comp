import type { FloorView } from '../../domain/derive';
import { num, pct } from '../../domain/format';
import { useFloorRoving } from './useFloorRoving';

export interface MiniStackProps {
  /** Top floor first (as `PlanModel.floors`). */
  floors: FloorView[];
  /** The open floor (outlined, `aria-current`); empty when none is open. */
  currentId: string;
  /** The floor under the pointer elsewhere (on the building model, say): lit, but not current. */
  hotId?: string | null;
  onPick: (floorId: string) => void;
  /** Pointing at or focusing a row lights that floor; null when it ends. It never opens the floor. */
  onPreview?: (floorId: string | null) => void;
  /** A row's accessible name and tooltip. Default: "Floor 8, 65.4% leased, 7,400 SF available". */
  describe?: (floor: FloorView) => string;
}

const leasedShare = (f: FloorView) => (f.leasable > 0 ? f.leased / f.leasable : 0);

/** "Floor 8, 65.4% leased, 7,400 SF available": what a row says when no lens adds to it. */
export function miniStackLabel(f: FloorView): string {
  return `${f.floor.name}, ${pct(leasedShare(f))} leased${f.available > 0 ? `, ${num(f.available)} SF available` : ''}`;
}

/**
 * Thin vertical floor picker: one row per floor, the open floor outlined. It is the keyboard
 * equivalent of the building model, so it is one tab stop: ↑ ↓ move between floors (lighting each on
 * the model), Home and End jump to the top and bottom, Enter or Space opens the floor (`useFloorRoving`).
 * It stands beside the docked model in the Building view and beside the plate in the Floor view; while
 * the building stands alone, the labels beside the model are the picker (building/FloorLabels).
 */
export function MiniStack({ floors, currentId, hotId, onPick, onPreview, describe = miniStackLabel }: MiniStackProps) {
  const roving = useFloorRoving(floors.map((f) => f.floor.id), currentId);
  return (
    <nav className="sp-mini" aria-label="Floors">
      <ol className="sp-mini__list">
        {floors.map((f, i) => {
          const share = leasedShare(f);
          const id = f.floor.id;
          const current = id === currentId;
          const label = describe(f);
          return (
            <li key={id}>
              <button
                type="button"
                {...roving.rowProps(i)}
                data-floor={id}
                className={`sp-mini__row ${current ? 'is-current' : ''} ${!current && id === hotId ? 'is-hot' : ''} ${share > 0.6 ? 'is-strong' : ''}`}
                aria-label={label}
                aria-current={current ? 'true' : undefined}
                title={label}
                onClick={() => onPick(id)}
                onPointerEnter={onPreview && (() => onPreview(id))}
                onPointerLeave={onPreview && (() => onPreview(null))}
                onFocus={() => {
                  roving.remember(id);
                  onPreview?.(id);
                }}
                onBlur={onPreview && (() => onPreview(null))}
              >
                <span className="sp-mini__fill" style={{ height: `${Math.max(8, Math.round(share * 100))}%`, top: 'auto' }} aria-hidden="true" />
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
