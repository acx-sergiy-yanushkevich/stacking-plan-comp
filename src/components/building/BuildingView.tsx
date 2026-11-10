import { useEffect, useMemo, useState } from 'react';
import type { FloorView as FloorViewModel } from '../../domain/derive';
import { fmtDate } from '../../domain/dates';
import { num, pct, sf } from '../../domain/format';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { setHoverFloor, useHoverFloor } from '../../state/hoverStore';
import { openFloor, openFloorPlate } from '../plan/actions';
import { Legend } from '../plan/Legend';
import { BuildingHero } from '../hero/BuildingHero';
import { FloorPlate } from '../floor/FloorPlate';
import { FloorSummary } from '../floor/FloorSummary';
import { MiniStack } from '../floor/MiniStack';
import { plateAspect, usePlateSize } from '../floor/usePlateSize';
import { FilterBar } from '../stack/FilterBar';
import { Button } from '../ui';
import '../floor/floor.css';
import './building.css';

export interface BuildingViewProps {
  model: PlanModel;
  state: PlanState;
  patch: (p: Partial<PlanState>) => void;
}

/**
 * The building as the plan. Left: the axonometric model, coloured by the lens, with a floor picker
 * as its keyboard equivalent. Right: the floor under the pointer, its plate above and its numbers
 * and lists below. Pointing previews a floor; a click pins it (and lifts the floors above it), so
 * the pointer can travel to the plate without the floor changing underneath.
 */
export default function BuildingView({ model, state, patch }: BuildingViewProps) {
  const { floors, property, highlight } = model;
  const hoverId = useHoverFloor();
  // The last floor pointed at stays on show once the pointer leaves the model.
  const [lastId, setLastId] = useState<string | null>(null);
  useEffect(() => {
    if (hoverId) setLastId(hoverId);
  }, [hoverId]);

  const byId = (id: string | null): FloorViewModel | null => (id ? (floors.find((f) => f.floor.id === id) ?? null) : null);
  // With nothing pointed at or pinned, open on the floor a broker came for: the one with the most space.
  const best = useMemo(() => floors.reduce<FloorViewModel | null>((b, f) => (!b || f.available > b.available ? f : b), null), [floors]);
  // While a search, the finder or the worklist is lighting suites, open on the first floor that has one.
  const lit = useMemo(() => (highlight ? (floors.find((f) => f.segments.some((s) => highlight.has(s.key))) ?? null) : null), [floors, highlight]);
  const hovered = byId(hoverId);
  const pinned = model.selectedFloor;
  const floor = hovered ?? pinned ?? byId(lastId) ?? lit ?? best;

  const aspect = useMemo(() => plateAspect(property.footprint), [property.footprint]);
  const [plateRef, size] = usePlateSize(aspect);

  const title = state.lens === 'status' ? 'Occupancy' : state.lens === 'expiry' ? 'Expirations' : state.lens === 'deals' ? 'Deal pipeline' : 'Rents';
  const head = (
    <div className="sp-stack__head">
      <div className="sp-stack__title">
        <h2>{title}</h2>
        <span className="sp-weak">
          as of {fmtDate(model.asOf)} · {num(model.kpis.leasable)} RSF leasable
        </span>
      </div>
      <Legend items={model.legend} compact id="sp-legend" />
    </div>
  );

  if (!floor) {
    return (
      <section className="sp-card sp-bview" aria-label="Building">
        {head}
        <p className="sp-floor__empty">This building has no floors on the plan.</p>
      </section>
    );
  }

  const id = floor.floor.id;
  const isPinned = !hovered && pinned?.floor.id === id;
  const pick = (floorId: string) => {
    // A second click on the pinned floor lets it go; a suite selection on that floor counts as a pin.
    if (state.floor === floorId && !state.select) patch({ floor: null });
    else openFloor(patch, floorId);
  };
  const leasedShare = floor.leasable > 0 ? floor.leased / floor.leasable : 0;
  const status = hovered
    ? pinned?.floor.id === id
      ? 'Pinned'
      : 'Preview · click the floor to pin it'
    : isPinned
      ? 'Pinned'
      : lastId === id
        ? 'Last floor you pointed at · click a floor to pin it'
        : lit?.floor.id === id
          ? 'First match · point at a floor to preview it, click to pin'
          : floor.available > 0
            ? 'Most space available · point at a floor to preview it, click to pin'
            : 'Point at a floor to preview it, click to pin';
  const caption =
    'Schematic: suite positions are proportional to RSF along the floor plate, not surveyed. ' +
    (property.footprintSource === 'demo' ? 'Demo footprint.' : 'Footprint © OpenStreetMap contributors.');

  return (
    <section className="sp-card sp-bview" aria-label="Building">
      {head}
      {model.filterLabel && <FilterBar label={model.filterLabel} alternatives={!!model.partial && model.partial.size > 0} patch={patch} />}
      <div className="sp-bview__grid">
        <div className="sp-bview__model">
          <MiniStack floors={floors} currentId={id} onPick={pick} onPreview={setHoverFloor} />
          <BuildingHero model={model} state={state} patch={patch} size="stage" onPick={pick} />
        </div>

        <div className="sp-bview__floor">
          <div className="sp-bview__floor-head">
            <h3 className="sp-floor__h">{floor.floor.name}</h3>
            <p className="sp-floor__facts">
              {num(floor.leasable)} RSF leasable · {pct(leasedShare)} leased · {sf(floor.available)} available
            </p>
            <div className="sp-bview__actions">
              {state.floor === id && !hovered && (
                <Button variant="ghost" size="sm" icon="close" onClick={() => patch({ floor: null })}>
                  Unpin
                </Button>
              )}
              <Button variant="neutral" size="sm" icon="floor" onClick={() => openFloorPlate(patch, id)} title="Open this floor on its own">
                Full floor plan
              </Button>
            </div>
          </div>
          <p className="sp-bview__state" aria-live="polite">
            {status}
          </p>
          <div className="sp-plate" ref={plateRef}>
            <FloorPlate floor={floor} model={model} state={state} patch={patch} width={size.width} height={size.height} />
          </div>
          <p className="sp-plate__caption">{caption}</p>
          <div className="sp-bview__info" role="group" aria-label={`${floor.floor.name} summary`}>
            <FloorSummary floor={floor} model={model} state={state} patch={patch} />
          </div>
        </div>
      </div>
    </section>
  );
}
