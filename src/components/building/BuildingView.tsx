import { useLayoutEffect, useMemo, useRef } from 'react';
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
import { usePrefersReducedMotion } from '../../lib/useMedia';
import { floorFact } from './floorFact';
import { availabilityFact } from '../floor/floorData';
import { canShowIssues } from '../../domain/safe';
import '../floor/floor.css';
import './building.css';

export interface BuildingViewProps {
  model: PlanModel;
  state: PlanState;
  patch: (p: Partial<PlanState>) => void;
}

/** How far the building is turned while it stands alone; it turns to face front (0) as a floor opens. */
const ALONE_ANGLE = -34;

/**
 * The building as the plan. With no floor open the model stands alone, large, with a fact beside each
 * floor. Opening a floor (a click, the picker, a search or the finder) turns the model to face front
 * and docks it on the left while that floor's plate, numbers and lists come in beside it. Pointing at
 * another floor then previews it; the pin holds while the pointer travels to the plate.
 */
export default function BuildingView({ model, state, patch }: BuildingViewProps) {
  const { floors, property, highlight } = model;
  const hoverId = useHoverFloor();
  const reduceMotion = usePrefersReducedMotion();

  const byId = (id: string | null): FloorViewModel | null => (id ? (floors.find((f) => f.floor.id === id) ?? null) : null);
  // While a search, the finder or the worklist is lighting suites, the first floor that has one opens.
  const lit = useMemo(() => (highlight ? (floors.find((f) => f.segments.some((s) => highlight.has(s.key))) ?? null) : null), [floors, highlight]);
  const hovered = byId(hoverId);
  const pinned = model.selectedFloor;
  const open = pinned ?? lit;
  const docked = !!open;
  const floor = docked ? (hovered ?? open) : null;
  // Where a broker usually starts: the floors with the most space, one click away.
  const starts = useMemo(() => floors.filter((f) => f.available > 0).sort((a, b) => b.available - a.available).slice(0, 3), [floors]);
  const tagFact = useMemo(() => {
    const facts = new Map(floors.map((f) => [f.floor.id, floorFact(f, state.lens, model.safe)]));
    return (id: string) => facts.get(id) ?? '';
  }, [floors, state.lens, model.safe]);

  // The model is sized to the room left below the header, KPIs and toolbar on first load (their height
  // varies with width), so the whole building and its picker sit above the fold.
  const modelRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = modelRef.current;
    if (!el) return;
    const fit = () => el.style.setProperty('--sp-bview-top', `${Math.round(el.getBoundingClientRect().top + window.scrollY)}px`);
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [docked, model.filterLabel]);

  // Docking and undocking: the model glides from where it stood to where it now stands (FLIP), while
  // BuildingHero turns it. Without this the model would jump between the two layouts.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const last = useRef<{ docked: boolean; rect: DOMRect } | null>(null);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const prev = last.current;
    last.current = { docked, rect };
    if (!prev || prev.docked === docked || reduceMotion || !el.animate || rect.height === 0) return;
    const scale = prev.rect.height / rect.height;
    const dx = prev.rect.left + prev.rect.width / 2 - (rect.left + rect.width / 2);
    const dy = prev.rect.top + prev.rect.height / 2 - (rect.top + rect.height / 2);
    el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${scale})` }, { transform: 'none' }], { duration: 760, easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)' });
  }, [docked, reduceMotion]);

  const aspect = useMemo(() => plateAspect(property.footprint), [property.footprint]);
  const [plateRef, size] = usePlateSize(aspect);

  const title = state.lens === 'status' ? 'Occupancy' : state.lens === 'expiry' ? 'Expirations' : state.lens === 'deals' ? 'Deal pipeline' : 'Rents';
  const over = floors.filter((f) => f.overAllocatedBy > 0);
  const head = (
    <div className="sp-stack__head">
      <div className="sp-stack__title">
        <h2>{title}</h2>
        <span className="sp-weak">
          as of {fmtDate(model.asOf)} · {num(model.kpis.leasable)} RSF leasable
        </span>
      </div>
      <Legend items={model.legend} compact id="sp-legend" />
      {over.length > 0 && canShowIssues(model.safe) && (
        <p className="sp-legend__note">
          {over.map((f) => `${f.floor.name} records exceed its leasable area by ${num(f.overAllocatedBy)} SF`).join('; ')}; legend shares use recorded SF, leased occupancy is capped.
        </p>
      )}
    </div>
  );

  if (floors.length === 0) {
    return (
      <section className="sp-card sp-bview" aria-label="Building">
        {head}
        <p className="sp-floor__empty">This building has no floors on the plan.</p>
      </section>
    );
  }

  const pick = (floorId: string) => {
    // A second click on the pinned floor lets it go; a suite selection on that floor counts as a pin.
    if (state.floor === floorId && !state.select) patch({ floor: null });
    else openFloor(patch, floorId);
  };
  const facts = (f: FloorViewModel) => {
    // "21,400 SF marketed from Apr '27" when nothing is free today but the floor is coming to market.
    const space = f.available === 0 ? availabilityFact(f, model.asOf, model.safe) : `${sf(f.available)} available`;
    return `${num(f.leasable)} RSF leasable · ${pct(f.leasable > 0 ? f.leased / f.leasable : 0)} leased · ${space === 'Nothing available' ? '0 SF available' : space}`;
  };
  const id = floor?.floor.id ?? null;
  const status = !floor
    ? ''
    : hovered && pinned?.floor.id !== id
      ? 'Preview · click the floor to pin it'
      : pinned?.floor.id === id
        ? 'Pinned'
        : 'First match · click a floor to pin it';
  const caption =
    'Schematic: suite positions are proportional to RSF along the floor plate, not surveyed. ' +
    (property.footprintSource === 'demo' ? 'Demo footprint.' : 'Footprint © OpenStreetMap contributors.');

  return (
    <section className="sp-card sp-bview" aria-label="Building">
      {head}
      {model.filterLabel && <FilterBar label={model.filterLabel} alternatives={!!model.partial && model.partial.size > 0} patch={patch} />}
      <div className={`sp-bview__grid ${docked ? '' : 'is-alone'}`}>
        <div className="sp-bview__model" ref={modelRef}>
          <MiniStack floors={floors} currentId={id ?? hoverId ?? ''} onPick={pick} onPreview={setHoverFloor} />
          <div className="sp-bview__stage" ref={stageRef}>
            <BuildingHero model={model} state={state} patch={patch} size="stage" onPick={pick} angle={docked ? 0 : ALONE_ANGLE} tagFact={docked ? undefined : tagFact} />
          </div>
        </div>

        {!floor ? (
          <div className="sp-bview__alone">
            <h3 className="sp-floor__h">{hovered ? hovered.floor.name : 'Pick a floor'}</h3>
            <p className="sp-floor__facts">{hovered ? `${facts(hovered)} · click to open its plan` : 'Point at a floor for its numbers. Click one to open its plan, suites and deals.'}</p>
            {starts.length > 0 && (
              <div className="sp-bview__starts" role="group" aria-label="Floors with the most space">
                <span className="sp-weak">Most space</span>
                {starts.map((f) => (
                  <Button key={f.floor.id} variant="neutral" size="sm" onClick={() => pick(f.floor.id)} onPointerEnter={() => setHoverFloor(f.floor.id)} onPointerLeave={() => setHoverFloor(null)}>
                    {f.floor.name} · {sf(f.available)}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="sp-bview__floor" key="floor">
            <div className="sp-bview__floor-head">
              <h3 className="sp-floor__h">{floor.floor.name}</h3>
              <p className="sp-floor__facts">{facts(floor)}</p>
              <div className="sp-bview__actions">
                {pinned && (
                  <Button variant="ghost" size="sm" icon="close" onClick={() => patch({ floor: null, select: null })} title="Close this floor and show the whole building">
                    Whole building
                  </Button>
                )}
                <Button variant="neutral" size="sm" icon="floor" onClick={() => openFloorPlate(patch, floor.floor.id)} title="Open this floor on its own">
                  Full floor plan
                </Button>
              </div>
            </div>
            {/* The status follows the pointer, so it is not announced; only a pin or an unpin is. */}
            <p className="sp-bview__state">{status}</p>
            <div className="sp-plate" ref={plateRef}>
              <FloorPlate floor={floor} model={model} state={state} patch={patch} width={size.width} height={size.height} />
            </div>
            <p className="sp-plate__caption">{caption}</p>
            <div className="sp-bview__info" role="group" aria-label={`${floor.floor.name} summary`}>
              <FloorSummary floor={floor} model={model} state={state} patch={patch} />
            </div>
          </div>
        )}
      </div>
      <p className="sp-sr-only" aria-live="polite">
        {pinned ? `${pinned.floor.name} open` : ''}
      </p>
    </section>
  );
}
