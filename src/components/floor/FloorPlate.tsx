import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { FloorView as FloorViewModel, Segment } from '../../domain/derive';
import { levelPolygon, polygonArea, projectPolygon, slicePolygon, type Pt } from '../../domain/geometry';
import { textTier } from '../../domain/layout';
import { fits, fitWords, measure, wrapWords } from '../../lib/textFit';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { selectSegment, type Patch } from '../plan/actions';
import { PATTERN_IDS } from '../plan/Patterns';
import { segmentText, type SegmentText } from '../plan/segmentText';
import { num, sf } from '../../domain/format';
import { inquiriesFor } from './floorData';

export interface FloorPlateProps {
  floor: FloorViewModel;
  model: PlanModel;
  state: PlanState;
  patch: Patch;
  width: number;
  height: number;
}

const FONT_NAME = "600 13px Inter, 'Salesforce Sans', system-ui, sans-serif";
const FONT_SUB = "400 12px Inter, 'Salesforce Sans', system-ui, sans-serif";
const FONT_BADGE = "600 11px Inter, 'Salesforce Sans', system-ui, sans-serif";
const PAD = 16;
const LINE = 15;
const SIDE = 6; // horizontal inset of labels inside a slice (each side)
const BADGE_H = 16;
const BADGE_PAD = 6;

interface Line {
  t: string;
  cls: string;
  font: string;
}

interface PlacedLine extends Line {
  x: number;
  y: number;
}

interface PlacedBadge {
  text: string;
  kind: string;
  title?: string;
  x: number;
  y: number;
  w: number;
}

const pathD = (pts: Pt[]) => (pts.length ? `M${pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('L')}Z` : '');

function bbox(pts: Pt[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Area centroid of a simple polygon; falls back to the bbox centre for degenerate shapes. */
function centroid(pts: Pt[]): Pt {
  const n = pts.length;
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % n];
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(a) < 1e-6) {
    const b = bbox(pts);
    return [b.minX + b.w / 2, b.minY + b.h / 2];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** Horizontal extent of the polygon along the line y = `y` (null when the line misses it). */
function chord(pts: Pt[], y: number): [number, number] | null {
  const n = pts.length;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
      const x = a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
      if (x < min) min = x;
      if (x > max) max = x;
    }
  }
  return min < max ? [min, max] : null;
}

/** Candidate label lines for a slice whose usable label width is `fw` and bbox height `bh`. */
function linesFor(text: SegmentText, tier: 0 | 1 | 2 | 3, fw: number, bh: number): Line[] {
  const lines: Line[] = [];
  if (tier <= 1) {
    for (const l of wrapWords(text.name, fw, FONT_NAME, 2)) lines.push({ t: l, cls: 'sp-seg__name', font: FONT_NAME });
    if (fits(text.sub, fw, FONT_SUB)) lines.push({ t: text.sub, cls: 'sp-seg__sub', font: FONT_SUB });
    else if (fits(`${text.sfShort} SF`, fw, FONT_SUB)) lines.push({ t: `${text.sfShort} SF`, cls: 'sp-seg__sub', font: FONT_SUB });
    if (text.meta && bh >= 4 * LINE + 2 * PAD) {
      if (fits(text.meta, fw, FONT_SUB)) lines.push({ t: text.meta, cls: 'sp-seg__meta', font: FONT_SUB });
      else {
        const short = fitWords(text.meta, fw, FONT_SUB);
        if (short.length >= 6) lines.push({ t: short, cls: 'sp-seg__meta', font: FONT_SUB });
      }
    }
  } else if (tier === 2) {
    if (fitWords(text.name, fw, FONT_NAME) === text.name) lines.push({ t: text.name, cls: 'sp-seg__name', font: FONT_NAME });
    if (fits(text.sfShort, fw, FONT_SUB)) lines.push({ t: text.sfShort, cls: 'sp-seg__sf', font: FONT_SUB });
  }
  return lines;
}

/**
 * Place lines centred on the slice: each line sits on the horizontal chord through its own
 * centre, so labels follow a rotated strip instead of spilling over its edges.
 */
function placeLines(poly: Pt[], cy: number, lines: Line[]): PlacedLine[] {
  const layout = (ls: Line[]) => {
    const top = cy - (ls.length * LINE) / 2;
    return ls.map((l, i) => {
      const mid = top + i * LINE + LINE / 2;
      const c = chord(poly, mid);
      return { ...l, x: c ? (c[0] + c[1]) / 2 : NaN, y: top + i * LINE + 11, fitsHere: !!c && c[1] - c[0] - 2 * SIDE >= measure(l.t, l.font) };
    });
  };
  const first = layout(lines).filter((l) => l.fitsHere);
  return layout(first.map(({ t, cls, font }) => ({ t, cls, font }))).map(({ t, cls, font, x, y }) => ({ t, cls, font, x, y }));
}

function placeBadges(poly: Pt[], text: SegmentText, blockTop: number, cy: number): PlacedBadge[] {
  const picks = text.badges.slice(0, 2);
  if (!picks.length) return [];
  const mid = (Number.isFinite(blockTop) ? blockTop : cy) - 4 - BADGE_H / 2;
  const c = chord(poly, mid);
  if (!c) return [];
  const avail = c[1] - c[0] - 2 * SIDE;
  const widths = picks.map((b) => Math.ceil(measure(b.text, FONT_BADGE)) + 2 * BADGE_PAD);
  let n = picks.length;
  const total = (k: number) => widths.slice(0, k).reduce((s, w) => s + w, 0) + 4 * Math.max(0, k - 1);
  while (n > 0 && total(n) > avail) n -= 1;
  if (n === 0) return [];
  let x = (c[0] + c[1]) / 2 - total(n) / 2;
  const out: PlacedBadge[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ text: picks[i].text, kind: picks[i].kind, title: picks[i].title, x, y: mid - BADGE_H / 2, w: widths[i] });
    x += widths[i] + 4;
  }
  return out;
}

interface Slice {
  seg: Segment;
  text: SegmentText;
  poly: Pt[];
  lines: PlacedLine[];
  badges: PlacedBadge[];
  tier: 0 | 1 | 2 | 3;
}

/** The floor plate: the footprint sliced into suites along its long axis, in lens tones. */
export function FloorPlate({ floor, model, state, patch, width, height }: FloorPlateProps) {
  const { property, safe, asOf, highlight } = model;
  const lens = state.lens;
  const refs = useRef<Array<SVGGElement | null>>([]);
  const [focusIdx, setFocusIdx] = useState(0);

  const points = useMemo(() => levelPolygon(projectPolygon(property.footprint, { w: width, h: height }, PAD), { w: width, h: height }, PAD), [property.footprint, width, height]);
  const outline = useMemo(() => pathD(points), [points]);

  const slices = useMemo<Slice[]>(() => {
    // The non-leasable area (lobby, loading, mechanical) is part of the plate too, so the stack and the plate agree.
    const lobbyKey = `${floor.floor.id}-lobby`;
    const lobby: Segment | null =
      floor.floor.nonLeasable > 0
        ? ({ key: lobbyKey, floorId: floor.floor.id, kind: 'unmarketed', size: floor.floor.nonLeasable, order: 9999, suite: null, endDate: null, monthsToExpiry: null } as Segment)
        : null;
    const segs = lobby ? [...floor.segments, lobby] : floor.segments;
    const polys = segs.length === 1 ? [points] : slicePolygon(points, segs.map((s) => s.size));
    return segs.map((seg, i) => {
      const poly = polys[i] ?? [];
      const matches = model.req ? inquiriesFor(seg, property.inquiries, asOf).length : 0;
      const text: SegmentText =
        seg.key === lobbyKey
          ? { tone: 'muted', pattern: 'hatch', name: 'Lobby · building use', sub: sf(seg.size), meta: 'Not leasable', badges: [], tooltip: `${floor.floor.name}: ${sf(seg.size)} non-leasable (lobby, loading, building use). Not counted in occupancy.`, aria: `${floor.floor.name}, lobby and building use, ${sf(seg.size)}, not leasable`, sfShort: num(seg.size) }
          : segmentText(seg, { safe, asOf, today: model.today, lens, floorName: floor.floor.name, matches: matches || undefined });
      if (poly.length < 3 || polygonArea(poly) < 1) return { seg, text, poly, lines: [], badges: [], tier: 3 as const };
      const b = bbox(poly);
      const [, cy] = centroid(poly);
      const c = chord(poly, cy);
      const usable = Math.min(b.w, c ? c[1] - c[0] : 0);
      const tier = textTier(usable);
      const lines = placeLines(poly, cy, linesFor(text, tier, usable - 2 * SIDE, b.h));
      const blockTop = lines.length ? lines[0].y - 11 : NaN;
      const badges = usable >= 120 ? placeBadges(poly, text, blockTop, cy) : [];
      return { seg, text, poly, lines, badges, tier };
    });
  }, [floor, points, model.req, property.inquiries, safe, asOf, lens]);

  const focusAt = (i: number) => {
    const n = slices.length;
    if (!n) return;
    const next = ((i % n) + n) % n;
    setFocusIdx(next);
    refs.current[next]?.focus();
  };

  const onKey = (e: KeyboardEvent<SVGGElement>, i: number) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        focusAt(i + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        focusAt(i - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusAt(0);
        break;
      case 'End':
        e.preventDefault();
        focusAt(slices.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        selectSegment(patch, slices[i].seg.key);
        break;
    }
  };

  const selectedIdx = slices.findIndex((s) => s.seg.key === state.select);
  const tabStop = Math.min(focusIdx, Math.max(0, slices.length - 1));

  return (
    <svg
      className="sp-plate__svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="group"
      aria-label={`${floor.floor.name} plate, schematic`}
    >
      {slices.map((s, i) => {
        const tone = s.text.tone;
        const fill = `var(--tone-${tone}-fill)`;
        const edge = `var(--tone-${tone}-edge)`;
        const color = `var(--tone-${tone}-text)`;
        const d = pathD(s.poly);
        const selected = i === selectedIdx;
        const dim = !!highlight && !highlight.has(s.seg.key);
        const p = s.text.pattern;
        const patternFill = p === 'hatch' ? `url(#${PATTERN_IDS.hatch})` : p === 'dots' ? `url(#${PATTERN_IDS.dots})` : p === 'asking' ? `url(#${PATTERN_IDS.asking})` : null;
        return (
          <g
            key={s.seg.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={['sp-seg', selected ? 'is-selected' : '', dim ? 'is-dim' : '', p === 'dashed' ? 'sp-seg--dashed' : ''].filter(Boolean).join(' ')}
            role={s.seg.key.endsWith('-lobby') ? 'img' : 'button'}
            tabIndex={s.seg.key.endsWith('-lobby') ? -1 : i === tabStop ? 0 : -1}
            aria-label={`${[...s.lines.map((l) => l.t), ...s.badges.map((b) => b.text)].filter(Boolean).join(' ')}${s.lines.length || s.badges.length ? '. ' : ''}${s.text.aria}`}
            aria-pressed={selected}
            data-key={s.seg.key}
            style={{ color: edge }}
            onClick={() => !s.seg.key.endsWith('-lobby') && selectSegment(patch, s.seg.key)}
            onFocus={() => setFocusIdx(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <title>{s.text.tooltip}</title>
            <path className="sp-seg__ring" d={d} />
            <path className="sp-seg__rect" d={d} fill={fill} stroke={edge} />
            {patternFill && <path d={d} fill={patternFill} pointerEvents="none" />}
            {s.lines.map((l, j) => (
              <text key={j} className={l.cls} x={l.x} y={l.y} fill={color} textAnchor="middle">
                {`${l.t} `}
              </text>
            ))}
            {s.badges.map((b, j) => (
              <g key={j} className={`sp-badge sp-badge--${b.kind}`} transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`}>
                <title>{b.title ?? b.text}</title>
                <rect width={b.w} height={BADGE_H} rx={BADGE_H / 2} />
                <text x={b.w / 2} y={11.5} textAnchor="middle">
                  {`${b.text} `}
                </text>
              </g>
            ))}
          </g>
        );
      })}
      <path className="sp-plate__outline" d={outline} fill="none" stroke="var(--sp-color-border-strong)" pointerEvents="none" />
    </svg>
  );
}
