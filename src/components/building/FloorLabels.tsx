import { useFloorRoving } from '../floor/useFloorRoving';
import { FloorLabelText } from './FloorLabelText';
import { FloorLeaders } from './FloorLeaders';
import type { FloorLabelParts } from './floorFact';

/** One floor of the list: what its label prints, says and lights. */
export interface FloorLabelRow {
  id: string;
  /** Leased share, 0 to 1, for the bar. */
  share: number;
  /** What the label prints: number, leased share, space, lens fact, the largest-block tag (`floorLabelParts`). */
  parts: FloorLabelParts;
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
  /** The model's quarter turn: its floors' right-hand points move with it, and the leaders are drawn to them again. */
  turn?: number;
  onPick: (floorId: string) => void;
  /** Pointing at or focusing a label lights that floor; null when it ends. It never opens the floor. */
  onPreview: (floorId: string | null) => void;
}

/**
 * The one list of floors beside the building while it stands alone: a label per floor, beside its
 * floor, reading "12 · 50.0% leased · 9,300 SF available". Each label is a button, so the list is also
 * the floor picker: pointing at one lights its floor on the model, a click opens it. One tab stop;
 * ↑ ↓ move between floors, Home and End jump, Enter or Space opens (`useFloorRoving`, as the docked
 * picker). The small bar before the number is the leased share once more, for the eye: the figure
 * stands beside it, so it is hidden from assistive technology and is never the only cue.
 *
 * A thin leader runs from each label to its floor (FloorLeaders), so a label is tied to its floor even
 * where the window is too low for the model's floors to be as far apart as the labels.
 *
 * The words are `FloorLabelText`, the component the Map view's floor list prints too, on the same grid
 * (floorLabel.css): the percentages line up on their decimals and the facts start on one edge.
 */
export function FloorLabels({ rows, hotId, onPick, onPreview, turn = 0 }: FloorLabelsProps) {
  const roving = useFloorRoving(rows.map((r) => r.id), '');
  return (
    <nav className="sp-flabels" aria-label="Floors">
      <FloorLeaders ids={rows.map((r) => r.id)} hotId={hotId} turn={turn} />
      <ol className="sp-floorlist sp-flabels__list">
        {rows.map((r, i) => (
          <li key={r.id}>
            <button
              type="button"
              {...roving.rowProps(i)}
              data-floor={r.id}
              className={`sp-floorlist__row sp-flabel ${r.id === hotId ? 'is-hot' : ''}`}
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
              <FloorLabelText parts={r.parts} />
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
