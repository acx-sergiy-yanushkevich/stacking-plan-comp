import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import type { FloorView as FloorViewModel } from '../../domain/derive';
import { num, pct } from '../../domain/format';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { backFromFloor, openFloorPlate } from '../plan/actions';
import { floorOrigin, takeFloorFocus } from '../../state/focusStore';
import { Button } from '../ui';
import { FloorPlate } from './FloorPlate';
import { MiniStack } from './MiniStack';
import { FloorSummary } from './FloorSummary';
import { availabilityFact } from './floorData';
import { plateAspect, usePlateSize } from './usePlateSize';
import './floor.css';

export interface FloorViewProps {
  model: PlanModel;
  state: PlanState;
  patch: (p: Partial<PlanState>) => void;
}

const EDITABLE = /^(INPUT|SELECT|TEXTAREA)$/;

/** Floor plate drill-in (DESIGN.md §2.7): breadcrumb, floor picker, sliced footprint, KPIs and lists. */
export default function FloorView({ model, state, patch }: FloorViewProps) {
  const { floors, property } = model;
  const floor = model.selectedFloor ?? floors[0] ?? null;

  const aspect = useMemo(() => plateAspect(property.footprint), [property.footprint]);
  const [plateRef, size] = usePlateSize(aspect);

  // Opened by a control ("Full floor plan", "Open floor plate"): that control is gone with its view, so
  // focus moves to this view's heading, which names the floor. Opened by a link, the page keeps its focus.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (takeFloorFocus()) headingRef.current?.focus();
  }, []);
  // Back returns to the view this one was opened from.
  const origin = floorOrigin();
  const backLabel = origin === 'building' ? 'Building' : 'Stack';

  if (!floor) {
    return (
      <section className="sp-floor sp-card" aria-label="Floor plate">
        <div className="sp-floor__bar">
          <Button variant="ghost" icon="arrow-left" onClick={() => backFromFloor(patch, state.floor)}>
            {backLabel}
          </Button>
        </div>
        <p className="sp-floor__empty">This floor is not on the plan.</p>
      </section>
    );
  }

  // `floors` is top first: the previous floor is the one below, the next the one above.
  const idx = floors.findIndex((f) => f.floor.id === floor.floor.id);
  const lower: FloorViewModel | null = idx >= 0 && idx < floors.length - 1 ? floors[idx + 1] : null;
  const upper: FloorViewModel | null = idx > 0 ? floors[idx - 1] : null;

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement;
    if (EDITABLE.test(t.tagName) || t.isContentEditable) return;
    if (e.key === 'ArrowLeft' && lower) {
      e.preventDefault();
      openFloorPlate(patch, lower.floor.id);
    } else if (e.key === 'ArrowRight' && upper) {
      e.preventDefault();
      openFloorPlate(patch, upper.floor.id);
    }
  };

  const leasedShare = floor.leasable > 0 ? floor.leased / floor.leasable : 0;
  const caption =
    'Schematic: suite positions are proportional to RSF along the floor plate, not surveyed. ' +
    (property.footprintSource === 'demo' ? 'Demo footprint.' : 'Footprint © OpenStreetMap contributors.');

  return (
    <section className="sp-floor sp-card" aria-label={`${floor.floor.name} plate`} onKeyDown={onKey}>
      <div className="sp-floor__bar">
        <nav className="sp-floor__crumb" aria-label="Breadcrumb">
          <ol>
            <li>
              <button type="button" className="sp-floor__crumb-link" onClick={() => backFromFloor(patch, floor.floor.id)}>
                {backLabel}
              </button>
            </li>
            <li aria-hidden="true" className="sp-floor__crumb-sep">
              ›
            </li>
            <li aria-current="page">{floor.floor.name}</li>
          </ol>
        </nav>
        <div className="sp-floor__nav">
          <Button
            variant="neutral"
            size="sm"
            icon="chevron-left"
            iconOnly
            aria-label={lower ? `Previous floor: ${lower.floor.name}` : 'Previous floor'}
            title={lower ? `${lower.floor.name} (←)` : 'Lowest floor'}
            disabled={!lower}
            onClick={() => lower && openFloorPlate(patch, lower.floor.id)}
          />
          <Button
            variant="neutral"
            size="sm"
            icon="chevron-right"
            iconOnly
            aria-label={upper ? `Next floor: ${upper.floor.name}` : 'Next floor'}
            title={upper ? `${upper.floor.name} (→)` : 'Top floor'}
            disabled={!upper}
            onClick={() => upper && openFloorPlate(patch, upper.floor.id)}
          />
        </div>
      </div>

      <div className="sp-floor__title">
        <h2 className="sp-floor__h" ref={headingRef} tabIndex={-1}>
          {floor.floor.name}
        </h2>
        <p className="sp-floor__facts">
          {num(floor.leasable)} RSF leasable · {pct(leasedShare)} leased · {availabilityFact(floor, model.asOf, model.safe)}
        </p>
      </div>

      <div className="sp-floor__grid">
        <MiniStack floors={floors} currentId={floor.floor.id} onPick={(id) => openFloorPlate(patch, id)} />

        <div className="sp-floor__plate">
          <div className="sp-plate" ref={plateRef}>
            <FloorPlate floor={floor} model={model} state={state} patch={patch} width={size.width} height={size.height} />
          </div>
          <p className="sp-plate__caption">{caption}</p>
        </div>

        <aside className="sp-floor__side" aria-label={`${floor.floor.name} summary`}>
          <FloorSummary floor={floor} model={model} state={state} patch={patch} />
        </aside>
      </div>
    </section>
  );
}
