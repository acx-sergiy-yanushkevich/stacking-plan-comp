import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { levelPolygon, projectPolygon, slicePolygon, type Pt } from '../../domain/geometry';
import { toneFor } from '../../domain/lenses';
import { PATTERN_IDS } from '../plan/Patterns';
import { patternFor } from '../plan/segmentText';
import { num, pct } from '../../domain/format';
import { openFloor, openFloorPlate, type Patch } from '../plan/actions';
import { setHoverFloor, useHoverFloor } from '../../state/hoverStore';
import { usePrefersReducedMotion } from '../../lib/useMedia';
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
  /** Stage only: a short fact printed after each floor number (for example "9,300 SF available"). */
  tagFact?: (floorId: string) => string;
}

/** Eases a number toward its target; jumps when the viewer asked for reduced motion. */
function useTween(target: number, ms = 760): number {
  const reduce = usePrefersReducedMotion();
  const cur = useRef(target);
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (cur.current === target) return;
    if (reduce || typeof requestAnimationFrame === 'undefined') {
      cur.current = target;
      setValue(target);
      return;
    }
    const from = cur.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      cur.current = from + (target - from) * (1 - Math.pow(1 - k, 3));
      setValue(cur.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
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
  available: number;
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
 * technology (the stack is the accessible equivalent), so the SVG is a labelled image.
 */
export function BuildingHero({ model, state, patch, compact, size = 'panel', onPick, angle = 0, tagFact }: BuildingHeroProps) {
  const stage = size === 'stage';
  const { W, H, HZ, LIFT, GAP } = stage ? STAGE : PANEL;
  const { property, floors, safe, highlight, segIndex } = model;
  const hoverId = useHoverFloor();
  const focusId = state.floor ?? (state.select ? (segIndex.get(state.select)?.floorId ?? null) : null);

  const tagPad = useMemo(() => (tagFact ? Math.max(0, ...floors.map((f) => tagFact(f.floor.id).length)) * 8.6 + 18 : 0), [tagFact, floors]);
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
      return { id: f.floor.id, name: f.floor.name, level, leasedPct: f.leasable ? f.leased / f.leasable : 0, leasable: f.leasable, available: f.available, keys: f.segments.map((sg) => sg.key), slices, tag: edge };
    });
    const ground = path(base.map((p) => iso(rot(p), 0)));
    // Room for the lift above, the floor tags on the right and the blurred ground shadow below.
    const tagRight = Math.max(...heroFloors.map((f) => f.tag[0])) + 34 + tagPad;
    const vx = Math.floor(box.x0 - 6);
    const vy = Math.floor(box.y0 - LIFT - 8);
    const viewBox = `${vx} ${vy} ${Math.ceil(Math.max(box.x1 + 6, tagRight) - vx)} ${Math.ceil(box.y1 + 20 - vy)}`;
    return { heroFloors: heroFloors.slice().sort((a, b) => a.level - b.level), fit: { ground, viewBox } };
  }, [property.footprint, floors, state.lens, safe, W, H, HZ, LIFT, GAP, tagPad]);
  // The frame (viewBox) belongs to the angle being turned to, so the model does not pulse while it turns.
  const shown = useTween(stage ? angle : 0);
  const rest = useMemo(() => build(stage ? angle : 0), [build, stage, angle]);
  const turning = useMemo(() => (shown === (stage ? angle : 0) ? null : build(shown)), [build, shown, stage, angle]);
  const { heroFloors } = turning ?? rest;
  const fit = { ground: (turning ?? rest).fit.ground, viewBox: rest.fit.viewBox };

  const focusLevel = focusId ? (heroFloors.find((f) => f.id === focusId)?.level ?? null) : null;
  const hot = heroFloors.find((f) => f.id === (hoverId ?? focusId)) ?? null;
  const NB = '\u00a0';
  const caption = hot
    ? `${hot.name.replace(' ', NB)} · ${pct(hot.leasedPct)}${NB}leased · ${num(hot.leasable)}${NB}RSF${hot.available ? ` · ${num(hot.available)}${NB}SF${NB}available` : ''}`
    : `${floors.length}${NB}floors · ${num(model.kpis.leasable)}${NB}RSF leasable`;
  const hint = hot ? (hot.id === focusId ? 'Click again to open the floor plan' : 'Click to focus this floor in the plan') : 'Hover a floor to trace it in the plan';

  return (
    <div className={`sp-hero ${compact ? 'sp-hero--compact' : ''} ${stage ? 'sp-hero--stage' : ''} ${tagFact ? 'sp-hero--facts' : ''}`}>
      <svg viewBox={stage ? fit.viewBox : `0 0 ${W} ${H}`} width={stage ? undefined : '100%'} role="img" aria-label={`Building model: ${floors.length} floors coloured by the active lens. The stack lists the same suites.`}>
        <path className="sp-hero__ground" d={fit.ground} aria-hidden="true" />
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
        {/* Floor-number tags: the top and bottom floors always, plus the floor under the pointer or in focus. */}
        {heroFloors
          .filter((f) => stage || f.level === 0 || f.level === heroFloors.length - 1 || f.id === hot?.id)
          .map((f) => {
            const lifted = focusLevel !== null && f.level > focusLevel;
            return (
              <text key={f.id} className={`sp-hero__tag ${f.id === hot?.id ? 'is-hot' : ''}`} x={f.tag[0] + 7} y={f.tag[1] + 3 - (lifted ? LIFT : 0)} aria-hidden="true">
                {f.name.replace(/^Floor\s+/i, '')}
                {tagFact?.(f.id) ? <tspan className="sp-hero__fact">{` · ${tagFact(f.id)}`}</tspan> : null}
              </text>
            );
          })}
      </svg>
      {!stage && (
        <p className="sp-hero__cap">
          <span className="sp-hero__cap-main">{caption}</span>
          {!compact && <span className="sp-hero__cap-hint">{hint}</span>}
        </p>
      )}
    </div>
  );
}
