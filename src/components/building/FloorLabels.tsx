import { LARGEST_BLOCK } from '../plan/segmentText';
import { useFloorRoving } from '../floor/useFloorRoving';

/** One floor of the list: what its label prints, says and lights. */
export interface FloorLabelRow {
  id: string;
  /** "12" */
  number: string;
  /** Leased share, 0 to 1, for the bar. */
  share: number;
  /** "50.0% leased" */
  leased: string;
  /** "9,300 SF available · holdover"; empty when the floor is full and the lens adds nothing. */
  fact: string;
  /** The floor that holds the building's largest block: its label carries the tag. */
  largest: boolean;
  /** Accessible name: "Floor 12, 50.0% leased, 9,300 SF available". */
  name: string;
  /** Tooltip: the floor's full sentence. */
  title: string;
}

export interface FloorLabelsProps {
  /** Top floor first. */
  rows: FloorLabelRow[];
  /** The floor under the pointer elsewhere (on the model): its label is lit. */
  hotId: string | null;
  onPick: (floorId: string) => void;
  /** Pointing at or focusing a label lights that floor; null when it ends. It never opens the floor. */
  onPreview: (floorId: string | null) => void;
}

/**
 * The one list of floors beside the building while it stands alone: a label per floor, level with its
 * floor, reading "12 · 50.0% leased · 9,300 SF available". Each label is a button, so the list is also
 * the floor picker: pointing at one lights its floor on the model, a click opens it. One tab stop;
 * ↑ ↓ move between floors, Home and End jump, Enter or Space opens (`useFloorRoving`, as the docked
 * picker). The small bar before the number is the leased share once more, for the eye: the figure
 * stands beside it, so it is hidden from assistive technology and is never the only cue.
 *
 * The parts are columns of one grid (building.css), so the percentages line up on their decimals and
 * the facts start on one edge down the building.
 */
export function FloorLabels({ rows, hotId, onPick, onPreview }: FloorLabelsProps) {
  const roving = useFloorRoving(rows.map((r) => r.id), '');
  return (
    <nav className="sp-flabels" aria-label="Floors">
      <ol className="sp-flabels__list">
        {rows.map((r, i) => (
          <li key={r.id}>
            <button
              type="button"
              {...roving.rowProps(i)}
              data-floor={r.id}
              className={`sp-flabel ${r.id === hotId ? 'is-hot' : ''}`}
              aria-label={r.name}
              title={r.title}
              onClick={() => onPick(r.id)}
              onPointerEnter={() => onPreview(r.id)}
              onPointerLeave={() => onPreview(null)}
              onFocus={() => {
                roving.remember(r.id);
                onPreview(r.id);
              }}
              onBlur={() => onPreview(null)}
            >
              <span className="sp-flabel__bar" aria-hidden="true">
                <span style={{ width: `${Math.round(Math.min(1, r.share) * 100)}%` }} />
              </span>
              <span className="sp-flabel__num">{r.number}</span>
              <span className="sp-flabel__sep">{' · '}</span>
              <span className="sp-flabel__pct">{r.leased}</span>
              <span className="sp-flabel__fact">
                {r.fact ? ` · ${r.fact}` : ''}
                {/* A space before the tag: read as text, the label is "… 9,300 SF available Largest block", as its name says it. */}
                {r.largest && ' '}
                {r.largest && <span className="sp-flabel__tag">{LARGEST_BLOCK}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
