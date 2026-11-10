import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fmtDate } from '../../domain/dates';
import { num, sf } from '../../domain/format';
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
import { KpiStrip, type KpiAction } from '../kpis/KpiStrip';
import { FilterBar } from '../stack/FilterBar';
import { Button } from '../ui';
import { usePrefersReducedMotion } from '../../lib/useMedia';
import { factNote, floorFact, floorLabel, floorSentence, lensFact } from './floorFact';
import { openFloorOf } from './openFloor';
import { canShowDeals, canShowIssues } from '../../domain/safe';
import '../floor/floor.css';
import '../kpis/kpis.css';
import './building.css';

export interface BuildingViewProps {
  model: PlanModel;
  state: PlanState;
  patch: (p: Partial<PlanState>) => void;
  /** What a click on one of the building's KPIs does (the same handler as the strip above the plan). */
  onKpi?: (a: KpiAction) => void;
}

/** How far the building is turned while it stands alone; it turns to face front (0) as a floor opens. */
const ALONE_ANGLE = -34;
const DOCK_MS = 760;
const DOCK_EASE = 'cubic-bezier(0.22, 0.8, 0.2, 1)';

/** An element's top edge in the page as laid out: transforms (a slide in progress) are left out. */
function layoutTop(el: HTMLElement): number {
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
  return y;
}

/**
 * The building as the plan. With no floor open the model stands alone, large, with a fact beside each
 * floor, the building's six KPIs and three quick starts in the column beside it. Opening a floor (a
 * click, the picker, a quick start, a search or the finder) turns the model to face front and docks it
 * on the left while that floor's plate, numbers and lists come in beside it.
 *
 * Pointing at a floor only lights it (on the model and in the picker) and, while the building stands
 * alone, puts its numbers on the caption line above the model. It never opens a floor and never
 * replaces the open one: a click does. The caption line has a fixed height, so nothing on the page
 * moves under the pointer.
 */
export default function BuildingView({ model, state, patch, onKpi }: BuildingViewProps) {
  const { floors, property, safe } = model;
  const hoverId = useHoverFloor();
  const reduceMotion = usePrefersReducedMotion();

  const { floor, pinned } = openFloorOf(model);
  const docked = !!floor;
  const openId = floor?.floor.id ?? null;
  const hovered = hoverId ? (floors.find((f) => f.floor.id === hoverId) ?? null) : null;
  // Where a broker usually starts: the floors with the most space, one click away.
  const starts = useMemo(() => floors.filter((f) => f.available > 0).sort((a, b) => b.available - a.available).slice(0, 3), [floors]);
  const texts = useMemo(() => {
    const byId = new Map(
      floors.map((f) => [
        f.floor.id,
        { fact: floorFact(f, state.lens, safe), label: floorLabel(f, state.lens, safe), sentence: `${f.floor.name} · ${floorSentence(f, model.asOf, safe)}` },
      ]),
    );
    return (id: string) => byId.get(id);
  }, [floors, state.lens, safe, model.asOf]);
  const tagFact = useMemo(() => (id: string) => texts(id)?.fact ?? '', [texts]);

  // The model is sized to the room left below the header, toolbar and legend (their height varies with
  // width, and the KPI strip comes and goes), so the whole building sits above the fold. Measured from the
  // layout, not the screen, so a slide in progress does not skew it.
  const stageRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => el.parentElement?.style.setProperty('--sp-bview-top', `${Math.round(layoutTop(el))}px`);
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [docked, model.filterLabel, state.lens, safe]);

  // Docking and undocking: the model and its picker glide from where they stood to where they now stand
  // (FLIP), while BuildingHero turns the model. Where they stood is read as the change is rendered,
  // before React touches the page, so it is exact however the page has moved since.
  const [wasDocked, setWasDocked] = useState(docked);
  const [from, setFrom] = useState<DOMRect | null>(null);
  if (wasDocked !== docked) {
    setWasDocked(docked);
    setFrom(stageRef.current?.getBoundingClientRect() ?? null);
  }
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el || !from || reduceMotion || !el.animate) return;
    const to = el.getBoundingClientRect();
    if (to.height === 0 || from.height === 0) return;
    // The picker and the building start at the left edge of the box in both states: hold that edge and
    // match the height, so the model never starts outside the card.
    const scale = from.height / to.height;
    const dx = from.left - to.left;
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const frames = [{ transformOrigin: 'left center', transform: `translate(${dx}px, ${dy}px) scale(${scale})` }, { transformOrigin: 'left center', transform: 'none' }];
    el.animate(frames, { duration: DOCK_MS, easing: DOCK_EASE });
  }, [from, reduceMotion]);

  // A stale pointer position must not light a floor after the layout has changed under it.
  useEffect(() => () => setHoverFloor(null), [docked]);

  // Keyboard focus never falls to the page: when the control that was used leaves the screen (a quick
  // start, "Whole building"), focus moves to that floor's row in the picker.
  const refocus = useRef<{ id: string; at: number } | null>(null);
  useEffect(() => {
    const want = refocus.current;
    refocus.current = null;
    if (!want || performance.now() - want.at > 2000) return;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    stageRef.current?.querySelector<HTMLElement>(`.sp-mini [data-floor="${want.id}"]`)?.focus({ preventScroll: true });
  }, [docked, openId]);

  const aspect = useMemo(() => plateAspect(property.footprint), [property.footprint]);
  const [plateRef, size] = usePlateSize(aspect);
  // The shared sizing stops at 300 px tall, which makes a narrow plate tall. Beside the docked model on a
  // tablet the plate column is narrow, so there the plate is drawn at 3:1 (the widest shape the sizing
  // allows), no shorter than 210 px: the plate and the floor's numbers then share the first screen.
  const plateHeight = size.width < 720 ? Math.min(size.height, Math.max(210, Math.round(size.width / 3))) : size.height;

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
    refocus.current = { id: floorId, at: performance.now() };
    // A second click on the pinned floor lets it go; a suite selection on that floor counts as a pin.
    if (state.floor === floorId && !state.select) patch({ floor: null });
    else openFloor(patch, floorId);
  };
  const wholeBuilding = () => {
    if (openId) refocus.current = { id: openId, at: performance.now() };
    patch({ floor: null, select: null });
  };
  const plateCaption =
    'Schematic: suite positions are proportional to RSF along the floor plate, not surveyed. ' +
    (property.footprintSource === 'demo' ? 'Demo footprint.' : 'Footprint © OpenStreetMap contributors.');
  const hoveredFact = hovered ? lensFact(hovered, state.lens, safe) : '';

  return (
    <section className="sp-card sp-bview" aria-label="Building">
      {head}
      {model.filterLabel && <FilterBar label={model.filterLabel} alternatives={!!model.partial && model.partial.size > 0} patch={patch} />}
      <div className={`sp-bview__grid ${docked ? 'is-docked' : 'is-alone'}`}>
        {!docked && (
          <div className="sp-bview__alone">
            <KpiStrip model={model} state={state} onAction={onKpi ?? (() => {})} variant="column" />
            {starts.length > 0 && (
              <div className="sp-bview__starts" role="group" aria-label="Floors with the most space">
                <span className="sp-bview__starts-label sp-label">Most space</span>
                {starts.map((f) => (
                  <Button
                    key={f.floor.id}
                    variant="neutral"
                    size="sm"
                    title={texts(f.floor.id)?.label}
                    onClick={() => pick(f.floor.id)}
                    onPointerEnter={() => setHoverFloor(f.floor.id)}
                    onPointerLeave={() => setHoverFloor(null)}
                    onFocus={() => setHoverFloor(f.floor.id)}
                    onBlur={() => setHoverFloor(null)}
                  >
                    {f.floor.name} · {sf(f.available)}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="sp-bview__model">
          {/* One line, always the same height: the numbers of the floor under the pointer, or the prompt. It
              follows the pointer, so it is not announced; the picker rows carry the same facts in their names. */}
          {!docked && (
            <p className="sp-bview__caption">
              {hovered ? (
                <>
                  <strong>{hovered.floor.name}</strong> · {floorSentence(hovered, model.asOf, safe)}
                  {hoveredFact ? ` · ${hoveredFact}` : ''} · click to open its plan
                </>
              ) : (
                `Point at a floor for its numbers. Click one to open its plan${canShowDeals(safe) ? ', suites and deals' : ' and suites'}.`
              )}
            </p>
          )}
          <div className="sp-bview__stage" ref={stageRef}>
            <BuildingHero
              model={model}
              state={state}
              patch={patch}
              size="stage"
              onPick={pick}
              angle={docked ? 0 : ALONE_ANGLE}
              tagFact={docked ? undefined : tagFact}
              floorTitle={(id) => `${texts(id)?.sentence ?? ''}${id === openId ? '' : docked ? ' · click to open this floor instead' : ' · click to open its plan'}`}
              beside={<MiniStack floors={floors} currentId={openId ?? ''} hotId={hoverId} onPick={pick} onPreview={setHoverFloor} describe={(f) => texts(f.floor.id)?.label ?? f.floor.name} />}
            />
          </div>
          {!docked && <p className="sp-bview__note">{factNote(state.lens, safe)}</p>}
        </div>

        {floor && (
          <div className="sp-bview__floor" key="floor">
            <div className="sp-bview__floor-head">
              <h3 className="sp-floor__h">{floor.floor.name}</h3>
              <p className="sp-floor__facts">{floorSentence(floor, model.asOf, safe)}</p>
              <div className="sp-bview__actions">
                {pinned && (
                  <Button variant="ghost" size="sm" icon="close" onClick={wholeBuilding} title="Close this floor and show the whole building">
                    Whole building
                  </Button>
                )}
                <Button variant="neutral" size="sm" icon="floor" onClick={() => openFloorPlate(patch, floor.floor.id)} title="Open this floor on its own">
                  Full floor plan
                </Button>
              </div>
            </div>
            {/* A floor the user opened needs no label. One a filter opened says so: it is the first match, not a choice. */}
            {!pinned && <p className="sp-bview__state">First floor that matches the filter. Click another floor to open it instead.</p>}
            <div className="sp-plate" ref={plateRef}>
              <FloorPlate floor={floor} model={model} state={state} patch={patch} width={size.width} height={plateHeight} />
            </div>
            <p className="sp-plate__caption">{plateCaption}</p>
            <div className="sp-bview__info" role="group" aria-label={`${floor.floor.name} summary`}>
              <FloorSummary floor={floor} model={model} state={state} patch={patch} />
            </div>
          </div>
        )}
      </div>
      <p className="sp-sr-only" aria-live="polite">
        {pinned && floor ? `${floor.floor.name} open` : ''}
      </p>
    </section>
  );
}
