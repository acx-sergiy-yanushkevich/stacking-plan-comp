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
import { rampNote } from '../stack/rampNote';
import { Button } from '../ui';
import { useMedia, usePrefersReducedMotion } from '../../lib/useMedia';
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
  /**
   * True (the default) where the card has room for the KPI column beside the model; false where the app
   * shows the six in the strip above the plan instead (a tablet, the inspector open). It never depends on
   * whether a floor is open (`kpiPlacement.ts`), so the column stays put through every open and close.
   */
  kpiColumn?: boolean;
}

/** How far the building is turned while it stands alone; it turns to face front (0) as a floor opens. */
const ALONE_ANGLE = -34;
const DOCK_MS = 760;
const DOCK_EASE = 'cubic-bezier(0.22, 0.8, 0.2, 1)';
/**
 * When the floor picker comes back while the model moves, as fractions of DOCK_MS. Docking, the model
 * glides toward the picker's new place from the right and never reaches it, so the picker fades in at
 * once. Undocking, the model starts where the picker will stand and has to pass it first.
 */
const PICKER_IN = { dock: [0.04, 0.34], undock: [0.56, 0.9] } as const;

/** Where the model's drawing stands on screen, and how many drawing units its height is. */
interface Stood {
  left: number;
  bottom: number;
  height: number;
  units: number;
}
function standing(stage: HTMLElement | null): Stood | null {
  const svg = stage?.querySelector<SVGSVGElement>('.sp-hero__canvas svg');
  if (!svg) return null;
  const r = svg.getBoundingClientRect();
  const units = svg.viewBox?.baseVal?.height ?? 0;
  return r.height > 0 && units > 0 ? { left: r.left, bottom: r.bottom, height: r.height, units } : null;
}

/** Where Escape belongs to what has the keyboard: a panel, a popover or menu, the phone sheet, a field. */
const ESCAPE_OWNERS = '.sp-ins, .sp-pop__panel, .sp-sheet, [role="dialog"], [role="menu"], [role="listbox"], input, select, textarea';

/** An element's top edge in the page as laid out: transforms (a slide in progress) are left out. */
function layoutTop(el: HTMLElement): number {
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
  return y;
}

/**
 * The building as the plan. With no floor open the model stands alone, large, with a fact beside each
 * floor. Opening a floor (a click, the picker, a quick start, a search or the finder) turns the model to
 * face front and docks it beside its picker while that floor's plate, numbers and lists come in on the right.
 *
 * Where the card has the room, the building's six KPIs and three quick starts are a column on the left in
 * both states: [KPIs | picker + model] alone, [KPIs | picker + model | the floor] docked. The column is
 * one element that is never re-created, so nothing in it moves when a floor opens or closes and a KPI
 * keeps the keyboard focus it had. Where there is no room, the app shows the KPIs above the plan instead.
 *
 * Pointing at a floor only lights it (on the model and in the picker) and, while the building stands
 * alone, puts its numbers on the caption line above the model. It never opens a floor and never
 * replaces the open one: a click does. The caption line has a fixed height, so nothing on the page
 * moves under the pointer.
 */
export default function BuildingView({ model, state, patch, onKpi, kpiColumn = true }: BuildingViewProps) {
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
  // width, and the KPI strip comes and goes with the inspector), so the whole building sits above the fold.
  // The KPI column is given the same room, measured from the top of the grid, which is the same whether a
  // floor is open or not. Measured from the layout, not the screen, so a slide in progress does not skew it.
  const stageRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      el.parentElement?.style.setProperty('--sp-bview-top', `${Math.round(layoutTop(el))}px`);
      const grid = el.closest<HTMLElement>('.sp-bview__grid');
      if (grid) grid.style.setProperty('--sp-bview-grid-top', `${Math.round(layoutTop(grid))}px`);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [docked, kpiColumn, model.filterLabel, state.lens, safe]);

  // Docking and undocking: the model glides from where it stood to where it now stands (FLIP), while
  // BuildingHero turns it. Where it stood is read as the change is rendered, before React touches the page,
  // so it is exact however the page has moved since.
  //
  // Only the drawing moves. It starts on the very pixels it occupied (same left edge, same ground line,
  // same size of a floor) and BuildingHero keeps its left edge fixed while it turns, so the model only ever
  // reaches to its right, into room that is empty: the floor's pane comes in after the model has settled
  // into its column, and the picker fades in at its new place once the model is clear of it (building.css,
  // PICKER_IN). Nothing is drawn over anything else at any frame.
  const [wasDocked, setWasDocked] = useState(docked);
  const [from, setFrom] = useState<Stood | null>(null);
  // While the model is on its way its floor labels are hidden; they fade back in when it has settled.
  const [moving, setMoving] = useState(false);
  if (wasDocked !== docked) {
    setWasDocked(docked);
    setFrom(standing(stageRef.current));
    setMoving(!reduceMotion);
  }
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const canvas = stage?.querySelector<HTMLElement>('.sp-hero__canvas') ?? null;
    const to = standing(stage);
    if (!stage || !canvas || !to || !from || reduceMotion || !canvas.animate) {
      setMoving(false);
      return;
    }
    const settled = window.setTimeout(() => setMoving(false), DOCK_MS);
    // One drawing unit is as many pixels as it was; the left edge and the ground line are held.
    const scale = from.height / from.units / (to.height / to.units);
    const dx = from.left - to.left;
    const dy = from.bottom - to.bottom;
    const running: Animation[] = [
      canvas.animate(
        [
          { transformOrigin: '0 100%', transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
          { transformOrigin: '0 100%', transform: 'none' },
        ],
        { duration: DOCK_MS, easing: DOCK_EASE },
      ),
    ];
    const picker = stage.querySelector<HTMLElement>('.sp-mini');
    const [a, b] = docked ? PICKER_IN.dock : PICKER_IN.undock;
    if (picker) running.push(picker.animate([{ opacity: 0 }, { opacity: 0, offset: a }, { opacity: 1, offset: b }, { opacity: 1 }], { duration: DOCK_MS }));
    return () => {
      window.clearTimeout(settled);
      for (const r of running) r.cancel();
    };
    // `docked` is read for the direction only; `from` changes with every dock and undock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, reduceMotion]);

  // A stale pointer position must not light a floor after the layout has changed under it.
  useEffect(() => () => setHoverFloor(null), [docked]);

  // Keyboard focus never falls to the page. Whenever a floor opens or closes and the control that had
  // focus has left the screen with it (a quick start, a KPI row, "Whole building", a suite on the plate
  // that Escape closed), focus moves to that floor's row in the picker. Escape asks for the row outright.
  const refocus = useRef<{ id: string; at: number; force?: boolean } | null>(null);
  const shownBefore = useRef({ docked, openId });
  useEffect(() => {
    const want = refocus.current && performance.now() - refocus.current.at <= 2000 ? refocus.current : null;
    refocus.current = null;
    const before = shownBefore.current;
    shownBefore.current = { docked, openId };
    // Only a change counts: not the first render (a link that opens a floor leaves focus where the browser put it).
    if (before.docked === docked && before.openId === openId) return;
    const id = want?.id ?? openId ?? before.openId;
    if (!id) return;
    const active = document.activeElement;
    const lost = !active || active === document.body || !active.isConnected;
    if (!lost && !want?.force) return;
    stageRef.current?.querySelector<HTMLElement>(`.sp-mini [data-floor="${id}"]`)?.focus({ preventScroll: true });
  }, [docked, openId]);

  // Escape closes the open floor and returns to the whole building, with focus on that floor's row in the
  // picker. Not while a panel, a popover, the sheet or a field has the keyboard (each closes itself), and
  // not when something nearer has already used the key (a selected suite on the plate clears first).
  useEffect(() => {
    if (!pinned || !openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && el !== document.body && el.closest(ESCAPE_OWNERS)) return;
      if (document.querySelector('.sp-sheet')) return;
      e.preventDefault();
      refocus.current = { id: openId, at: performance.now(), force: true };
      patch({ floor: null, select: null });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pinned, openId, patch]);

  const aspect = useMemo(() => plateAspect(property.footprint), [property.footprint]);
  const [plateRef, size] = usePlateSize(aspect);
  // The shared sizing stops at 300 px tall, which makes a narrow plate tall. Beside the docked model on a
  // tablet the plate column is narrow, so there the plate is drawn at 3:1 (the widest shape the sizing
  // allows), no shorter than 210 px. A short window (a tablet held sideways, 768 px tall) has no room for
  // that and the floor's four figures: there the plate may be as low as 180 px, so the figures start on
  // the first screen. Labels that no longer fit a suite move to the numbered key, never cut.
  // Beside the KPI column the plan starts high on the page (no strip above it), so there the plate keeps
  // the footprint's own shape at the width of its pane, down to 210 px.
  const shortWindow = useMedia('(max-height: 820px)') && !kpiColumn;
  const squat = Math.max(shortWindow ? 180 : 210, Math.round(size.width / (shortWindow ? 3.7 : 3)));
  const shaped = Math.max(210, Math.round(size.width / Math.min(3, Math.max(4 / 3, aspect))));
  const plateHeight = size.width < 720 ? Math.min(size.height, kpiColumn ? shaped : squat) : size.height;

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
      <Legend items={model.legend} compact id="sp-legend" note={rampNote(state.lens, safe)} />
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
      <div className={`sp-bview__grid ${docked ? 'is-docked' : 'is-alone'} ${kpiColumn ? 'has-kpis' : ''} ${moving ? 'is-moving' : ''}`}>
        {/* The KPI column: the same element in both states, so it neither moves nor loses focus when a floor
            opens or closes. Without the column (the KPIs are above the plan) the quick starts are a line
            above the model while it stands alone; with a floor open the picker is the way between floors. */}
        {(kpiColumn || (!docked && starts.length > 0)) && (
          <div className="sp-bview__side">
            {kpiColumn && <KpiStrip model={model} state={state} onAction={onKpi ?? (() => {})} variant="column" />}
            {starts.length > 0 && (
              <div className="sp-bview__starts" role="group" aria-label="Floors with the most space">
                <span className="sp-bview__starts-label sp-label">Most space</span>
                {starts.map((f) => (
                  <Button
                    key={f.floor.id}
                    variant="neutral"
                    size="sm"
                    active={f.floor.id === openId}
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
            <div className="sp-bview__lead">
              <p className="sp-bview__caption">
                {hovered ? (
                  <>
                    <strong>{hovered.floor.name}</strong> · {floorSentence(hovered, model.asOf, safe)}
                    {hoveredFact ? ` · ${hoveredFact}` : ''}
                    <span className="sp-bview__caption-more"> · click to open its plan</span>
                  </>
                ) : (
                  `Point at a floor for its numbers. Click one to open its plan${canShowDeals(safe) ? ', suites and deals' : ' and suites'}.`
                )}
              </p>
              {/* What the words beside the floors are, kept with the line above: the two are read together, then the model. */}
              <p className="sp-bview__note">{factNote(state.lens, safe)}</p>
            </div>
          )}
          <div className={`sp-bview__stage ${moving ? 'is-moving' : ''}`} ref={stageRef}>
            <BuildingHero
              model={model}
              state={state}
              patch={patch}
              size="stage"
              onPick={pick}
              angle={docked ? 0 : ALONE_ANGLE}
              tagFact={docked ? undefined : tagFact}
              openId={openId}
              floorTitle={(id) => `${texts(id)?.sentence ?? ''}${id === openId ? '' : docked ? ' · click to open this floor instead' : ' · click to open its plan'}`}
              beside={<MiniStack floors={floors} currentId={openId ?? ''} hotId={hoverId} onPick={pick} onPreview={setHoverFloor} describe={(f) => texts(f.floor.id)?.label ?? f.floor.name} />}
            />
          </div>
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
