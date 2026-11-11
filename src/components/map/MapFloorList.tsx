import { useMemo, useRef, type KeyboardEvent } from 'react';
import type { FloorView } from '../../domain/derive';
import { num } from '../../domain/format';
import { toneLabel } from '../../domain/lenses';
import type { ISODate } from '../../domain/types';
import type { Lens } from '../../state/planState';
import { FloorLabelText } from '../building/FloorLabelText';
import { floorLabel, floorLabelParts, floorSentence, lensDetail } from '../building/floorFact';
import { dominantTone, floorAlso, swatchTones } from './mapStyle';
import { focused } from '../../lib/host';

export interface MapFloorListProps {
  floors: FloorView[];
  lens: Lens;
  safe: boolean;
  asOf: ISODate;
  /** The floor that is open (pressed in the list, capped on the map). */
  selected: string | null;
  /** The floor that holds the building's largest block (the KPI's): its row carries the tag. */
  largestId: string | null;
  onSelect: (floorId: string) => void;
}

/**
 * The Map view's list of floors: the keyboard-reachable equivalent of clicking a 3D floor (DESIGN.md §6),
 * and the words for what the extrusion shows by colour.
 *
 * A row prints the floor's one label, through the same component and from the same parts as the list
 * beside the Building view's model (`FloorLabelText`, `floorLabelParts`): the two views show one
 * building, so a floor reads the same in both, to the letter and at the same size. What only the map
 * has is the swatch before the label: the legend's colour for the fact the label names (`swatchTones`:
 * the step of the next expiry, the furthest deal stage, the band of the rent it gives, the space on offer
 * the status label leads with), and in its lower half the color of an at-risk or expiring lease the floor also holds.
 *
 * A row's accessible name is the Building label's name, then what the map adds: the floor's size, the
 * state of most of the floor (what colours most of it on the map) and what else is on it (a unit for
 * sale, an area with no record). Its tooltip is the Building label's tooltip, then the same.
 */
export function MapFloorList({ floors, lens, safe, asOf, selected, largestId, onSelect }: MapFloorListProps) {
  const ordered = useMemo(() => [...floors].sort((a, b) => b.floor.sequence - a.floor.sequence), [floors]);
  const ref = useRef<HTMLDivElement>(null);
  const focusIndex = Math.max(
    0,
    ordered.findIndex((f) => f.floor.id === selected),
  );
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = ordered.findIndex((f) => f.floor.id === (focused() as HTMLElement | null)?.dataset.floor);
    if (i < 0) return;
    let next = i;
    if (e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'ArrowDown') next = Math.min(ordered.length - 1, i + 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ordered.length - 1;
    else return;
    e.preventDefault();
    const target = ordered[next];
    onSelect(target.floor.id);
    ref.current?.querySelector<HTMLButtonElement>(`[data-floor="${target.floor.id}"]`)?.focus();
  };
  return (
    <div ref={ref} className="sp-map-floors" role="group" aria-label="Floors" onKeyDown={onKey}>
      <ol className="sp-floorlist sp-map-floors__list">
        {ordered.map((f, i) => {
          const largest = f.floor.id === largestId;
          const { tone, accent } = swatchTones(f, lens, safe);
          const mostly = toneLabel(dominantTone(f, lens, safe), lens, safe);
          const also = floorAlso(f, safe);
          const more = `${mostly ? `mostly ${mostly}` : ''}${also ? `${mostly ? '; ' : ''}also: ${also}` : ''}`;
          return (
            <li key={f.floor.id}>
              <button
                type="button"
                data-floor={f.floor.id}
                className="sp-floorlist__row sp-map-floor"
                aria-pressed={f.floor.id === selected}
                aria-label={`${floorLabel(f, lens, safe, largest)}. ${num(f.leasable)} RSF leasable${more ? `, ${more}` : ''}`}
                title={[f.floor.name, floorSentence(f, asOf, safe), lensDetail(f, lens, safe), largest ? 'the largest block in the building' : '', more].filter(Boolean).join(' · ')}
                tabIndex={i === focusIndex ? 0 : -1}
                onClick={() => onSelect(f.floor.id)}
              >
                <span
                  className="sp-map-floor__swatch"
                  style={{
                    background: accent ? `linear-gradient(135deg, var(--tone-${tone}-fill) 0 50%, var(--tone-${accent}-edge) 50%)` : `var(--tone-${tone}-fill)`,
                    borderColor: `var(--tone-${accent ?? tone}-edge)`,
                  }}
                  aria-hidden="true"
                />
                <FloorLabelText parts={floorLabelParts(f, lens, safe, largest)} />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
