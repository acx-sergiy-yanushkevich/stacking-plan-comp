import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { levelPolygon, projectPolygon, slicePolygon, type Pt } from '../../domain/geometry';
import { toneFor } from '../../domain/lenses';
import { PATTERN_IDS } from '../plan/Patterns';
import { patternFor } from '../plan/segmentText';
import { num, pct } from '../../domain/format';
import { openFloor, openFloorPlate, type Patch } from '../plan/actions';
import { setHoverFloor, useHoverFloor, useHoverKeys } from '../../state/hoverStore';
import { usePrefersReducedMotion } from '../../lib/useMedia';
import { cancelFrame, requestFrame, sizeObserver } from '../../lib/host';
import { spaceOf } from '../building/floorFact';
import { DotJoin } from './DotJoin';
import './hero.css';

export interface BuildingHeroProps {
  model: PlanModel;
  state: PlanState;
  patch: Patch;
  /** Smaller, without the hint line (while a suite's details are open). */
  compact?: boolean;
  /** `stage` draws the model large, as a view of its own, with every floor numbered and no caption. */
  size?: 'panel' | 'stage';
  /** What a click on a floor does. Default: focus the floor, then open its floor plan on a second click. */
  onPick?: (floorId: string) => void;
  /** Stage only: how far the building is turned about its vertical axis, in degrees. A change is animated. */
  angle?: number;
  /** A tooltip for each floor of the model (its numbers in a sentence). */
  floorTitle?: (floorId: string) => string;
  /**
   * Stage only: the floor that is open beside the model. When one is, the model numbers only that floor
   * and the floor under the pointer: the picker standing beside it already names every floor, and a
   * docked model has under a line of type per floor, where twelve numbers would touch.
   */
  openId?: string | null;
  /** Stage only: what stands to the left of the drawing (the compact floor picker, while a floor is open). */
  beside?: ReactNode;
  /**
   * Stage only: what stands to the right of the drawing in place of the model's own floor numbers: the
   * list of floors, one label per floor (while no floor is open). It is given the height of the drawing
   * and three shares of that height, `--sp-hero-tags-above`, `--sp-hero-tags-band` and
   * `--sp-hero-tags-below`: the room above the top floor's label, the run of the labels, and the room
   * under the bottom one. A list laid out by them has each label level with the floor it names. The
   * model also marks each floor's point on its right-hand edge (`[data-anchor]`, at the angle it is
   * turning to), for the list to draw a leader to.
   */
  after?: ReactNode;
}

/** Eases a number toward its target; jumps when the viewer asked for reduced motion. */
function useTween(target: number, ms = 760): number {
  const reduce = usePrefersReducedMotion();
  const cur = useRef(target);
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (cur.current === target) return;
    const jump = () => {
      cur.current = target;
      setValue(target);
    };
    if (reduce) return jump();
    const from = cur.current;
    const t0 = performance.now();
    let raf: number | null = null;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      cur.current = from + (target - from) * (1 - Math.pow(1 - k, 3));
      setValue(cur.current);
      if (k < 1) raf = requestFrame(step);
    };
    raf = requestFrame(step);
    // Where nothing is painted there are no frames to ease across: the number jumps.
    if (raf === null) return jump();
    return () => cancelFrame(raf);
  }, [target, ms, reduce]);
  return value;
}

interface Dims {
  W: number;
  H: number;
  /** Floor-to-floor height on screen. */
  HZ: number;
  /** How far the floors above a focused floor lift, to show its plate. */
  LIFT: number;
  /** Gap between two slabs. */
  GAP: number;
}
const PANEL: Dims = { W: 328, H: 276, HZ: 10, LIFT: 20, GAP: 1 };
const STAGE: Dims = { W: 600, H: 640, HZ: 28, LIFT: 44, GAP: 2 };
/** Floor labels are HTML over the drawing, so their size is in CSS px whatever the model's scale. */
const TAG_PX = 12;
const COS = 0.866;
const SIN = 0.5;
const BOX = 200;

interface Face {
  d: string;
  /** Darkening for the face: side walls are shaded by the way they face. */
  shade: number;
}
interface HeroSlice {
  key: string;
  tone: string;
  /** Same second cue as the stack: dots for sublease, hatch for committed and lobby, dashed for vacant. */
  pattern: 'hatch' | 'dots' | 'dashed' | null;
  depth: number;
  top: string;
  walls: Face[];
}
interface HeroFloor {
  id: string;
  name: string;
  level: number;
  leasedPct: number;
  leasable: number;
  /** The space on offer today in words ("7,400 SF available", "7,000 SF sublease available"); empty when none. */
  space: string;
  keys: string[];
  slices: HeroSlice[];
  /** Where the floor-number tag sits: just right of the slab. */
  tag: Pt;
}

const fillOf = (tone: string) => (tone === 'empty' || tone === 'deal-none' ? 'var(--sp-color-card-2)' : `var(--tone-${tone}-solid, var(--tone-${tone}-fill))`);

/**
 * The building in axonometric view: every floor is a slab cut into its suites and coloured by the
 * active lens. It mirrors the stack: hovering a floor here lights it in the plan and the other way
 * round; a click focuses the floor, a second click opens its floor plan. Decorative for assistive
 * technology (the stack, or in the Building view the list of floors beside it, is the accessible
 * equivalent), so the SVG is a labelled image. The floor numbers are HTML laid over the drawing: they keep their size
 * in CSS px however small the model is drawn.
 */
export function BuildingHero({ model, state, patch, compact, size = 'panel', onPick, angle = 0, floorTitle, openId = null, beside, after }: BuildingHeroProps) {
  const stage = size === 'stage';
  const { W, H, HZ: BASE_HZ, LIFT, GAP } = stage ? STAGE : PANEL;
  // A floor's height on screen: the size's own, unless the floors would take more than 60 % of the height,
  // as in a tall tower. Then every floor gets thinner, so the building keeps its footprint drawn to scale.
  const HZ = Math.min(BASE_HZ, ((H - 14 - LIFT) * 0.6) / Math.max(1, model.floors.length));
  const { property, floors, safe, segIndex } = model;
  const hoverId = useHoverFloor();
  // A KPI or a finder option pointed at lights its suites for as long as it is pointed at; otherwise the active filter does.
  const hoverKeys = useHoverKeys();
  const highlight = hoverKeys ?? model.highlight;
  const focusId = state.floor ?? (state.select ? (segIndex.get(state.select)?.floorId ?? null) : null);
  // On the stage the floors above a floor in focus lift, and the frame keeps room for that above the roof.
  // With no floor in focus nothing lifts: the frame closes on the building, which is then drawn larger.
  const liftRoom = !stage || focusId !== null || openId !== null;

  // Room to the right of the drawing for the model's own floor numbers, in CSS px. A list of floors
  // standing there (`after`) brings its own width.
  const tagRoom = useMemo(() => {
    if (after) return 0;
    const digits = Math.max(1, ...floors.map((f) => f.floor.name.replace(/^Floor\s+/i, '').length));
    return Math.ceil(10 + digits * TAG_PX * 0.64);
  }, [after, floors]);
  const build = useCallback((deg: number) => {
    const base = levelPolygon(projectPolygon(property.footprint, { w: BOX, h: BOX }, 0), { w: BOX, h: BOX }, 0);
    const cx = (Math.min(...base.map((p) => p[0])) + Math.max(...base.map((p) => p[0]))) / 2;
    const cy = (Math.min(...base.map((p) => p[1])) + Math.max(...base.map((p) => p[1]))) / 2;
    const maxSize = Math.max(...floors.map((f) => f.floor.size));
    // Plan extent in axonometric space at full size, to fit the building into the card.
    const ax = base.map(([u, v]) => (u - cx - (v - cy)) * COS);
    const ay = base.map(([u, v]) => (u - cx + (v - cy)) * SIN);
    const xr = Math.max(...ax) - Math.min(...ax);
    const yr = Math.max(...ay) - Math.min(...ay);
    const n = floors.length;
    const s = Math.min((W - 60) / xr, (H - 14 - n * HZ - LIFT) / yr);
    const ox = W / 2 - (s * (Math.max(...ax) + Math.min(...ax))) / 2;
    const oy = H - 8 - s * Math.max(...ay);
    // Track what is drawn, so the stage can fit its viewBox to the building instead of a fixed box.
    const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const iso = (p: Pt, z: number): Pt => {
      const q: Pt = [ox + s * (p[0] - cx - (p[1] - cy)) * COS, oy + s * (p[0] - cx + (p[1] - cy)) * SIN - z];
      box.x0 = Math.min(box.x0, q[0]); box.x1 = Math.max(box.x1, q[0]);
      box.y0 = Math.min(box.y0, q[1]); box.y1 = Math.max(box.y1, q[1]);
      return q;
    };
    // Turning the building: every point goes round the plan centre before it is projected. Suites are
    // sliced first, so they keep their place on the floor whatever the angle.
    const rad = (deg * Math.PI) / 180;
    const cs = Math.cos(rad);
    const sn = Math.sin(rad);
    const rot = (p: Pt): Pt => (deg === 0 ? p : [cx + (p[0] - cx) * cs - (p[1] - cy) * sn, cy + (p[0] - cx) * sn + (p[1] - cy) * cs]);
    const path = (pts: Pt[]) => `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}Z`;

    const heroFloors: HeroFloor[] = floors.map((f, i) => {
      const level = n - 1 - i;
      const k = Math.sqrt(f.floor.size / maxSize);
      const poly: Pt[] = base.map(([u, v]) => [cx + (u - cx) * k, cy + (v - cy) * k]);
      const lobbyKey = `${f.floor.id}-lobby`;
      const cue = (p: string | null): HeroSlice['pattern'] => (p === 'hatch' || p === 'dots' || p === 'dashed' ? p : null);
      const parts = [
        ...f.segments.map((sg) => {
          const tone = toneFor(sg, state.lens, safe);
          return { key: sg.key, size: sg.size, tone: tone as string, pattern: cue(patternFor(sg, tone, state.lens)) };
        }),
        ...(f.floor.nonLeasable > 0 ? [{ key: lobbyKey, size: f.floor.nonLeasable, tone: 'muted', pattern: 'hatch' as const }] : []),
      ];
      const polys = parts.length === 1 ? [poly] : slicePolygon(poly, parts.map((p) => p.size));
      const z0 = level * HZ;
      const z1 = z0 + HZ - GAP;
      const slices: HeroSlice[] = parts
        .map((part, j) => {
          const pts = (polys[j] ?? []).map(rot);
          if (pts.length < 3) return null;
          let area = 0;
          for (let a = 0; a < pts.length; a++) {
            const b = (a + 1) % pts.length;
            area += pts[a][0] * pts[b][1] - pts[b][0] * pts[a][1];
          }
          const sign = area >= 0 ? 1 : -1;
          const walls: Face[] = [];
          for (let a = 0; a < pts.length; a++) {
            const b = (a + 1) % pts.length;
            const nx = sign * (pts[b][1] - pts[a][1]);
            const ny = -sign * (pts[b][0] - pts[a][0]);
            // Walls whose outward normal points toward the viewer (the +u +v corner) are visible.
            if (nx + ny <= 0.01) continue;
            walls.push({ d: path([iso(pts[a], z0), iso(pts[b], z0), iso(pts[b], z1), iso(pts[a], z1)]), shade: ny > nx ? 0.1 : 0.26 });
          }
          const depth = pts.reduce((t, p) => t + p[0] + p[1], 0) / pts.length;
          return { key: part.key, tone: part.tone, pattern: part.pattern, depth, top: path(pts.map((p) => iso(p, z1))), walls };
        })
        .filter((x): x is HeroSlice => x !== null)
        .sort((a, b) => a.depth - b.depth);
      const edge = poly.map((p) => iso(rot(p), z0 + HZ / 2)).reduce((best, p) => (p[0] > best[0] ? p : best));
      return { id: f.floor.id, name: f.floor.name, level, leasedPct: f.leasable ? f.leased / f.leasable : 0, leasable: f.leasable, space: spaceOf(f), keys: f.segments.map((sg) => sg.key), slices, tag: edge };
    });
    const ground = path(base.map((p) => iso(rot(p), 0)));
    // Room for the lift above (when a floor can be in focus) and the blurred ground shadow below; the floor labels sit outside the drawing.
    const vx = Math.floor(box.x0 - 6);
    const vy = Math.floor(box.y0 - (liftRoom ? LIFT : 0) - 8);
    const frame = { x: vx, y: vy, w: Math.ceil(box.x1 + 6 - vx), h: Math.ceil(box.y1 + 20 - vy) };
    // Where the floors' labels stand, top to bottom, as shares of the frame's height: the run from the top
    // floor's label to the bottom one's (one step per floor), and the room above and under it.
    const ys = heroFloors.map((f) => f.tag[1]);
    const top = Math.min(...ys);
    const step = n > 1 ? (Math.max(...ys) - top) / (n - 1) : HZ;
    const above = Math.max(0, (top - step / 2 - vy) / frame.h);
    const run = (step * n) / frame.h;
    const ladder = { above, run, below: Math.max(0, 1 - above - run) };
    return { heroFloors: heroFloors.slice().sort((a, b) => a.level - b.level), fit: { ground, frame, ladder, left: box.x0 } };
  }, [property.footprint, floors, state.lens, safe, W, H, HZ, LIFT, GAP, liftRoom]);
  // The frame (viewBox) belongs to the angle being turned to, so the model does not pulse while it turns.
  // A building is wider seen from a corner than from the front, so while it turns it is wider than the
  // frame it is turning into. Its left edge is held on the frame's left edge the whole way: the drawing
  // then only ever reaches out to its right, never over what stands to its left (the floor picker).
  const shown = useTween(stage ? angle : 0);
  const rest = useMemo(() => build(stage ? angle : 0), [build, stage, angle]);
  const turning = useMemo(() => (shown === (stage ? angle : 0) ? null : build(shown)), [build, shown, stage, angle]);
  const { heroFloors } = turning ?? rest;
  const frame = stage ? rest.fit.frame : { x: 0, y: 0, w: W, h: H };
  const ground = (turning ?? rest).fit.ground;
  const slide = turning ? rest.fit.left - turning.fit.left : 0;

  const focusLevel = focusId ? (heroFloors.find((f) => f.id === focusId)?.level ?? null) : null;
  const hot = heroFloors.find((f) => f.id === (hoverId ?? focusId)) ?? null;
  // The facts of the caption line, each in one piece: the line breaks between them, never with a separator at either end (DotJoin).
  const caption = hot ? [hot.name, `${pct(hot.leasedPct)} leased`, `${num(hot.leasable)} RSF`, hot.space] : [`${floors.length} floors`, `${num(model.kpis.leasable)} RSF leasable`];
  const hint = hot ? (hot.id === focusId ? 'Click again to open the floor plan' : 'Click to focus this floor in the plan') : 'Hover a floor to trace it in the plan';

  // Every floor is numbered on the stage while no floor is open and the numbers have room: with less than a
  // line of type per floor they would run into each other at a readable size, so a small model names its
  // top and bottom floors, the floor in focus and the floor under the pointer. With a floor open, only
  // that floor and the one under the pointer are numbered (the picker beside the model names them all).
  // With a list of floors standing beside the drawing (`after`) the model prints no number of its own.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drawnHeight, setDrawnHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el || !stage) return;
    // The laid-out height: a transform in progress (the dock animation) must not count.
    const measure = () => setDrawnHeight(el.clientHeight || null);
    measure();
    const ro = sizeObserver(measure);
    if (!ro) return;
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage]);
  const roomy = stage && (drawnHeight === null || (HZ * drawnHeight) / frame.h >= TAG_PX);
  const tagged = after
    ? []
    : openId
      ? heroFloors.filter((f) => f.id === openId || f.id === hoverId)
      : heroFloors.filter((f) => roomy || f.level === 0 || f.level === heroFloors.length - 1 || f.id === hot?.id || f.id === focusId);
  // In the Building view the list of floors stands beside the model; in a panel the stack is on screen.
  const label = stage
    ? `Building model: ${floors.length} floors, each cut into its suites and colored by the active lens. The list of floors beside it names every floor with the same figures.`
    : `Building model: ${floors.length} floors colored by the active lens. The stack lists the same suites.`;

  return (
    <div
      className={`sp-hero ${compact ? 'sp-hero--compact' : ''} ${stage ? 'sp-hero--stage' : ''} ${stage && openId ? 'sp-hero--open' : ''}`}
      style={{ '--sp-hero-ratio': (frame.w / frame.h).toFixed(4), '--sp-hero-room': `${tagRoom}px`, '--sp-hero-tags-above': rest.fit.ladder.above.toFixed(4), '--sp-hero-tags-band': rest.fit.ladder.run.toFixed(4), '--sp-hero-tags-below': rest.fit.ladder.below.toFixed(4), '--sp-hero-floors': floors.length } as CSSProperties}
    >
      {stage && beside && <div className="sp-hero__beside">{beside}</div>}
      <div className="sp-hero__canvas">
        <svg ref={svgRef} viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`} role="img" aria-label={label}>
          <g transform={slide ? `translate(${slide.toFixed(1)} 0)` : undefined}>
          <path className="sp-hero__ground" d={ground} aria-hidden="true" />
          {heroFloors.map((f) => {
            const above = focusLevel !== null && f.level > focusLevel;
            const cls = ['sp-hero__floor', f.id === hoverId ? 'is-hot' : '', f.id === focusId ? 'is-focus' : '', above ? 'is-above' : ''].filter(Boolean).join(' ');
            return (
              <g
                key={f.id}
                className={cls}
                aria-hidden="true"
                transform={above ? `translate(0 ${-LIFT})` : undefined}
                onPointerEnter={() => setHoverFloor(f.id)}
                onPointerLeave={() => setHoverFloor(null)}
                onClick={() => {
                  if (onPick) onPick(f.id);
                  else if (f.id === focusId) openFloorPlate(patch, f.id);
                  else openFloor(patch, f.id);
                }}
              >
                {floorTitle && <title>{floorTitle(f.id)}</title>}
                {f.slices.map((sl) => {
                  const dim = !!highlight && !highlight.has(sl.key);
                  const selected = state.select === sl.key;
                  return (
                    <g key={sl.key} className={`sp-hero__slice ${dim ? 'is-dim' : ''} ${selected ? 'is-selected' : ''}`}>
                      {sl.walls.map((w, i) => (
                        <g key={i}>
                          <path className={`sp-hero__face ${sl.pattern === 'dashed' ? 'is-dashed' : ''}`} d={w.d} fill={fillOf(sl.tone)} style={{ color: `var(--tone-${sl.tone}-edge)` }} />
                          {(sl.pattern === 'hatch' || sl.pattern === 'dots') && <path className="sp-hero__pattern" d={w.d} fill={`url(#${sl.pattern === 'hatch' ? PATTERN_IDS.hatch : PATTERN_IDS.dots})`} style={{ color: `var(--tone-${sl.tone}-edge)` }} />}
                          <path className="sp-hero__shade" d={w.d} fillOpacity={w.shade} />
                        </g>
                      ))}
                      <path className={`sp-hero__face sp-hero__top ${sl.pattern === 'dashed' ? 'is-dashed' : ''}`} d={sl.top} fill={fillOf(sl.tone)} style={{ color: `var(--tone-${sl.tone}-edge)` }} />
                      {(sl.pattern === 'hatch' || sl.pattern === 'dots') && <path className="sp-hero__pattern" d={sl.top} fill={`url(#${sl.pattern === 'hatch' ? PATTERN_IDS.hatch : PATTERN_IDS.dots})`} style={{ color: `var(--tone-${sl.tone}-edge)` }} />}
                    </g>
                  );
                })}
              </g>
            );
          })}
          </g>
        </svg>
        {/* Floor numbers: on the stage every floor (only the open one and the one pointed at while a floor is open;
            none where a list of floors stands beside the drawing); in a panel the top and bottom floors, plus
            the floor under the pointer or in focus. */}
        <div className="sp-hero__tags" aria-hidden="true">
          {/* Where each floor ends on the right, at rest: the list of floors beside the drawing draws its leaders to these. */}
          {stage &&
            after &&
            rest.heroFloors.map((f) => (
              <i key={`anchor-${f.id}`} className="sp-hero__anchor" data-anchor={f.id} style={{ left: `${(((f.tag[0] - frame.x) / frame.w) * 100).toFixed(2)}%`, top: `${(((f.tag[1] - frame.y) / frame.h) * 100).toFixed(2)}%` }} />
            ))}
          {tagged.map((f) => {
            const lifted = focusLevel !== null && f.level > focusLevel;
            return (
              <span
                key={f.id}
                className={`sp-hero__tag ${f.id === hot?.id ? 'is-hot' : ''} ${f.id === openId ? 'is-open' : ''}`}
                style={{ left: `${(((f.tag[0] + slide - frame.x) / frame.w) * 100).toFixed(2)}%`, top: `${(((f.tag[1] - (lifted ? LIFT : 0) - frame.y) / frame.h) * 100).toFixed(2)}%` }}
              >
                {f.name.replace(/^Floor\s+/i, '')}
              </span>
            );
          })}
        </div>
      </div>
      {stage && after && <div className="sp-hero__after">{after}</div>}
      {!stage && (
        <p className="sp-hero__cap">
          <span className="sp-hero__cap-main">
            <DotJoin parts={caption} />
          </span>
          {!compact && <span className="sp-hero__cap-hint">{hint}</span>}
        </p>
      )}
    </div>
  );
}
