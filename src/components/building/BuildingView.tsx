import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fmtDate } from '../../domain/dates';
import { num } from '../../domain/format';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { setHoverFloor, useHoverFloor } from '../../state/hoverStore';
import { openFloor, openFloorPlate } from '../plan/actions';
import { buildingUse, Legend } from '../plan/Legend';
import { BuildingHero } from '../hero/BuildingHero';
import { DotJoin, DotSep } from '../hero/DotJoin';
import { FloorPlate } from '../floor/FloorPlate';
import { FloorSummary } from '../floor/FloorSummary';
import { MiniStack } from '../floor/MiniStack';
import { plateAspect, usePlateSize } from '../floor/usePlateSize';
import { FilterBar } from '../stack/FilterBar';
import { rampNote } from '../stack/rampNote';
import { Button } from '../ui';
import { useMedia, usePrefersReducedMotion } from '../../lib/useMedia';
import { find, focused, on, sizeObserver } from '../../lib/host';
import { floorHeading, floorLabel, floorLabelParts, floorSentence, labelNote, lensDetail } from './floorFact';
import { FloorLabels, type FloorLabelRow } from './FloorLabels';
import { clearFrom, cubicBezier, type Box, type Glide } from './glide';
import { openFloorOf } from './openFloor';
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
const DOCK_MS = 760;
/** The glide's easing, as the animation's curve and as the same curve to reckon with (glide.ts). */
const DOCK_CURVE = [0.22, 0.8, 0.2, 1] as const;
const DOCK_EASE = `cubic-bezier(${DOCK_CURVE.join(', ')})`;
const dockEase = cubicBezier(...DOCK_CURVE);
/** How long the floor picker or the list of floors takes to fade in beside the model, as a share of DOCK_MS (about 180 ms). */
const FADE_IN = 0.24;
/** The narrowest the model may be drawn with the list of floors beside it; with less room the list goes under it. */
const MIN_MODEL = 240;
/** The space between the model and the list beside it, which the leaders cross (building.css, `--sp-hero-gap`). */
const LIST_GAP = 40;

/** Where the model's drawing stands on screen, and how many drawing units its height is. */
interface Stood extends Box {
  units: number;
}
function standing(stage: HTMLElement | null): Stood | null {
  const svg = stage?.querySelector<SVGSVGElement>('.sp-hero__canvas svg');
  if (!svg) return null;
  const r = svg.getBoundingClientRect();
  const units = svg.viewBox?.baseVal?.height ?? 0;
  return r.height > 0 && units > 0 ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, units } : null;
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
 * The building as the plan. With no floor open the model stands alone, large, with one list of floors
 * beside it: a label per floor, level with its floor ("12 · 50.0% leased · 9,300 SF available"). The
 * labels are buttons, so the list is the floor picker too, and the floors are listed once. Opening a
 * floor (a click on the model or on a label, a search or the finder) turns the model to face front and
 * docks it beside a compact picker while that floor's plate, numbers and lists come in on the right.
 *
 * The card holds nothing else: the building's KPIs are the bar above the toolbar (App), the same in every
 * view. Alone, the model with its list is centred and takes the height there is under one caption line.
 * Where the list has no room beside the model (a narrow card, a long lens fact) it stands under it.
 * Docked, there are two columns: [picker + model | the floor], and the picker is the way between floors.
 *
 * Pointing at a floor only lights it (on the model and in the list) and, while the building stands
 * alone, puts its numbers on the caption line above the model. It never opens a floor and never
 * replaces the open one: a click does. The caption line has a fixed height, so nothing on the page
 * moves under the pointer.
 *
 * The floor that holds the building's largest block (the one the KPI reports) carries a "Largest block"
 * tag on its label.
 */
export default function BuildingView({ model, state, patch }: BuildingViewProps) {
  const { floors, property, safe } = model;
  const hoverId = useHoverFloor();
  const reduceMotion = usePrefersReducedMotion();

  const { floor, pinned } = openFloorOf(model);
  const docked = !!floor;
  const openId = floor?.floor.id ?? null;
  const hovered = hoverId ? (floors.find((f) => f.floor.id === hoverId) ?? null) : null;
  // One row per floor, top floor first: what its label prints, its accessible name and its tooltip.
  const largestId = model.kpis.maxContiguous.floorId;
  const rows = useMemo<FloorLabelRow[]>(
    () =>
      floors.map((f) => {
        const largest = f.floor.id === largestId;
        return {
          id: f.floor.id,
          share: f.leasable > 0 ? f.leased / f.leasable : 0,
          // The floor's one label (floorFact): the Map view's floor list prints the same parts.
          parts: floorLabelParts(f, state.lens, safe, largest),
          name: floorLabel(f, state.lens, safe, largest),
          // The tooltip of the label and of the floor on the model: the floor's sentence, then what the lens says of it, in full.
          title: [f.floor.name, floorSentence(f, model.asOf, safe), lensDetail(f, state.lens, safe), largest ? 'the largest block in the building' : ''].filter(Boolean).join(' · '),
        };
      }),
    [floors, state.lens, safe, model.asOf, largestId],
  );
  const rowOf = useMemo(() => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    return (id: string) => byId.get(id);
  }, [rows]);

  // The model is sized to the room left below the header, the KPI bar, the toolbar and the legend (their
  // height varies with width), so the whole building sits above the fold. Measured from the layout, not
  // the screen, so a slide in progress does not skew it.
  const stageRef = useRef<HTMLDivElement | null>(null);
  // Alone, the list of floors stands beside the model while the model keeps a readable width; otherwise
  // under it. The list is as wide as its longest label (it never wraps or cuts one), so its width is
  // measured and the model is given the rest of the column.
  const [under, setUnder] = useState(false);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => el.parentElement?.style.setProperty('--sp-bview-top', `${Math.round(layoutTop(el))}px`);
    fit();
    return on('resize', fit);
  }, [docked, model.filterLabel, state.lens, safe, under]);
  useLayoutEffect(() => {
    const col = stageRef.current?.parentElement;
    const list = stageRef.current?.querySelector<HTMLElement>('.sp-flabels__list');
    if (docked || !col || !list) return;
    const fit = () => {
      const width = Math.ceil(list.getBoundingClientRect().width);
      if (!width) return;
      col.style.setProperty('--sp-bview-list', `${width}px`);
      setUnder(col.clientWidth - width - LIST_GAP < MIN_MODEL);
    };
    fit();
    const ro = sizeObserver(fit);
    if (!ro) return;
    ro.observe(col);
    ro.observe(list);
    return () => ro.disconnect();
  }, [docked, rows]);

  // Docking and undocking: the model glides from where it stood to where it now stands (FLIP), while
  // BuildingHero turns it. Where it stood is read as the change is rendered, before React touches the page,
  // so it is exact however the page has moved since.
  //
  // Only the drawing moves. It starts on the very pixels it occupied (same left edge, same ground line,
  // same size of a floor) and BuildingHero keeps its left edge fixed while it turns. What comes in beside
  // it is timed from where the model is, not from a fixed delay: the floor picker (docking) and the list of
  // floors (undocking) stay invisible for as long as the gliding model's box touches their place, reckoned
  // from the same two rectangles and the same easing as the glide (glide.ts), and then fade in. Where the
  // model never crosses their place, which is the usual case, they come in at once: the list of floors is
  // back within a quarter of a second of "Whole building". The floor's pane comes in after the model has
  // settled into its column (building.css). Nothing is drawn over anything else at any frame, at any width.
  const [wasDocked, setWasDocked] = useState(docked);
  const [from, setFrom] = useState<Stood | null>(null);
  // While the model is on its way its floor numbers and the leaders to its floors are hidden; they fade back in when it has settled.
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
    // One drawing unit is as many pixels as it was; the left edge and the ground line are held.
    const scale = (from.bottom - from.top) / from.units / ((to.bottom - to.top) / to.units);
    const glide: Glide = { to, dx: from.left - to.left, dy: from.bottom - to.bottom, scale };
    const move = canvas.animate(
      [
        { transformOrigin: '0 100%', transform: `translate(${glide.dx}px, ${glide.dy}px) scale(${scale})` },
        { transformOrigin: '0 100%', transform: 'none' },
      ],
      { duration: DOCK_MS, easing: DOCK_EASE },
    );
    // The model has settled when its own animation ends: one clock for the glide and for what waits on it.
    move.onfinish = () => setMoving(false);
    const running: Animation[] = [move];
    for (const el of stage.querySelectorAll<HTMLElement>('.sp-mini, .sp-flabels')) {
      // Hidden while the model's box touches its place, then a short fade.
      const shown = clearFrom(glide, el.getBoundingClientRect(), dockEase);
      running.push(el.animate([{ opacity: 0 }, { opacity: 0, offset: shown }, { opacity: 1, offset: Math.min(1, shown + FADE_IN) }, { opacity: 1 }], { duration: DOCK_MS }));
    }
    return () => {
      for (const r of running) r.cancel();
    };
    // `docked` is read for the direction only; `from` changes with every dock and undock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, reduceMotion]);

  // A stale pointer position must not light a floor after the layout has changed under it.
  useEffect(() => () => setHoverFloor(null), [docked]);

  // Keyboard focus never falls to the page. Opening or closing a floor replaces the control that was
  // pressed (a floor's label becomes its row in the picker; "Whole building" and the picker leave with the
  // floor), so where the keyboard goes is decided before the state changes (`aim`: that floor, in the
  // list that will be on screen) and applied as the change is committed, in a layout effect: the new list
  // is in the page by then, and nothing depends on a timer or on what the browser has done with focus in
  // between. A change that was not aimed (a suite on the plate that Escape closed, a filter that opened a
  // floor) is caught the same way when the control that had focus has left the screen with it.
  const refocus = useRef<{ id: string; force: boolean } | null>(null);
  const shownBefore = useRef({ docked, openId });
  /** Before a change of floor: the floor whose control takes the keyboard after it. Not from a control outside this view, which stays on screen and keeps its focus. */
  const aim = (id: string) => {
    const el = focused();
    refocus.current = { id, force: !el || el.id === 'sp-plan' || !!el.closest('.sp-bview') };
  };
  useLayoutEffect(() => {
    // Read on every commit: an aim that no change followed (a click that changed nothing) is dropped here.
    const want = refocus.current;
    refocus.current = null;
    const before = shownBefore.current;
    shownBefore.current = { docked, openId };
    // Only a change counts: not the first render (a link that opens a floor leaves focus where the browser put it).
    if (before.docked === docked && before.openId === openId) return;
    const id = want?.id ?? openId ?? before.openId;
    if (!id) return;
    const active = focused();
    const lost = !active || !active.isConnected;
    if (!lost && !want?.force) return;
    stageRef.current?.querySelector<HTMLElement>(`:is(.sp-mini, .sp-flabels) [data-floor="${id}"]`)?.focus({ preventScroll: true });
  });

  // Escape closes the open floor and returns to the whole building, with focus on that floor's label
  // beside the model. Not while a panel, a popover, the sheet or a field has the keyboard (each closes itself), and
  // not when something nearer has already used the key (a selected suite on the plate clears first).
  // Focus is taken to the picker from inside this view only: a control above the plan (a KPI, the toolbar,
  // the header) is still there after the floor has closed, so the keyboard stays on it.
  const aimRef = useRef(aim);
  aimRef.current = aim;
  useEffect(() => {
    if (!pinned || !openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const el = focused();
      if (el && el.closest(ESCAPE_OWNERS)) return;
      if (find('.sp-sheet')) return;
      e.preventDefault();
      aimRef.current(openId);
      patch({ floor: null, select: null });
    };
    return on('keydown', onKey);
  }, [pinned, openId, patch]);

  const aspect = useMemo(() => plateAspect(property.footprint), [property.footprint]);
  const [plateRef, size] = usePlateSize(aspect);
  // The shared sizing stops at 300 px tall, which makes a narrow plate tall. Beside the docked model on a
  // tablet the plate column is narrow, so there the plate is drawn at 3:1 (the widest shape the sizing
  // allows), no shorter than 210 px. A short window (a tablet held sideways, 768 px tall) has no room for
  // that and the floor's four figures: there the plate may be as low as 180 px, so the figures start on
  // the first screen. Labels that no longer fit a suite move to the numbered key, never cut.
  const shortWindow = useMedia('(max-height: 820px)');
  const squat = Math.max(shortWindow ? 180 : 210, Math.round(size.width / (shortWindow ? 3.7 : 3)));
  const plateHeight = size.width < 720 ? Math.min(size.height, squat) : size.height;

  const title = state.lens === 'status' ? 'Occupancy' : state.lens === 'expiry' ? 'Expirations' : state.lens === 'deals' ? 'Deal pipeline' : 'Rents';
  const over = floors.filter((f) => f.overAllocatedBy > 0);
  const lobby = buildingUse(floors);
  const head = (
    <div className="sp-stack__head">
      <div className="sp-stack__title">
        <h2>{title}</h2>
        <span className="sp-weak">
          as of {fmtDate(model.asOf)} · {num(model.kpis.leasable)} RSF leasable
        </span>
      </div>
      {/* The model draws the lobby as a grey hatch; the Stack view labels it in the block, here the legend names it. */}
      {/* The caveats (which end of a colour ramp is which, a floor whose records exceed its area) are the
          legend's info mark: there for whoever asks, never a line of warnings over the plan. */}
      <Legend
        items={model.legend}
        extras={lobby ? [lobby] : undefined}
        compact
        id="sp-legend"
        note={
          [
            rampNote(state.lens, safe),
            over.length > 0 && canShowIssues(model.safe) ? `${over.map((f) => `${f.floor.name} records exceed its leasable area by ${num(f.overAllocatedBy)} SF`).join('; ')}; legend shares use recorded SF, leased occupancy is capped.` : null,
          ]
            .filter(Boolean)
            .join(' ') || null
        }
      />
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
    aim(floorId);
    // A second click on the pinned floor lets it go; a suite selection on that floor counts as a pin.
    if (state.floor === floorId && !state.select) patch({ floor: null });
    else openFloor(patch, floorId);
  };
  const wholeBuilding = () => {
    if (openId) aim(openId);
    patch({ floor: null, select: null });
  };
  const plateCaption =
    // A no-break space after the comma: where the caption wraps, the line does not end on it.
    'Schematic: suite positions are proportional to RSF along the floor plate,\u00a0not surveyed. ' +
    (property.footprintSource === 'demo' ? 'Demo footprint.' : 'Footprint © OpenStreetMap contributors.');
  // The caption line as facts with a "·" between them: it breaks between facts, never with a separator at either end (DotJoin).
  const hoveredParts = hovered ? [...floorSentence(hovered, model.asOf, safe).split(' · '), ...lensDetail(hovered, state.lens, safe).split(' · ')] : [];
  const noteParts = labelNote(state.lens, safe).split(' · ');

  return (
    <section className="sp-card sp-bview" aria-label="Building">
      {head}
      {model.filterLabel && <FilterBar label={model.filterLabel} alternatives={!!model.partial && model.partial.size > 0} patch={patch} />}
      <div className={`sp-bview__grid ${docked ? 'is-docked' : 'is-alone'} ${!docked && under ? 'is-under' : ''} ${moving ? 'is-moving' : ''}`}>
        <div className="sp-bview__model">
          {/* Above the model while it stands alone, one quiet line of fixed height, so nothing moves under the
              pointer: the numbers of the floor pointed at, or what to do and what the labels show. It follows
              the pointer, so it is not announced; each label carries the same facts in its name. */}
          {!docked && (
            <p className="sp-bview__caption">
              <span>
                {hovered ? (
                  <>
                    <DotJoin parts={[<strong>{hovered.floor.name}</strong>, ...hoveredParts]} />
                    <span className="sp-bview__caption-more">
                      <DotSep />
                      <span className="sp-nb">click to open its plan</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="sp-nb">Click a floor or its label to open its plan.</span>{' '}
                    {/* Each thing the labels show stays in one piece: a narrow card breaks the line between them, never inside one. */}
                    <DotJoin parts={noteParts.map((part, i) => `${i === 0 ? 'Labels: ' : ''}${part}${i === noteParts.length - 1 ? '.' : ''}`)} />
                  </>
                )}
              </span>
            </p>
          )}
          <div className={`sp-bview__stage ${moving ? 'is-moving' : ''}`} ref={stageRef}>
            <BuildingHero
              model={model}
              state={state}
              patch={patch}
              size="stage"
              onPick={pick}
              angle={docked ? 0 : ALONE_ANGLE}
              openId={openId}
              floorTitle={(id) => `${rowOf(id)?.title ?? ''}${id === openId ? '' : docked ? ' · click to open this floor instead' : ' · click to open its plan'}`}
              // One list of floors at a time: the compact picker beside the docked model, the labels beside the model alone.
              beside={docked ? <MiniStack floors={floors} currentId={openId ?? ''} hotId={hoverId} onPick={pick} onPreview={setHoverFloor} describe={(f) => rowOf(f.floor.id)?.name ?? f.floor.name} /> : undefined}
              after={docked ? undefined : <FloorLabels rows={rows} hotId={hoverId} onPick={pick} onPreview={setHoverFloor} />}
            />
          </div>
        </div>

        {floor && (
          <div className="sp-bview__floor" key="floor">
            <div className="sp-bview__floor-head">
              <h3 className="sp-floor__h">{floor.floor.name}</h3>
              {/* The floor's size alone: the cards under the plate carry leased, available and when space comes to market. */}
              <p className="sp-floor__facts">{floorHeading(floor)}</p>
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
