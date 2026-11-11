import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { FloorView as FloorViewModel, Segment } from '../../domain/derive';
import { levelPolygon, polygonArea, projectPolygon, slicePolygon, type Pt } from '../../domain/geometry';
import { textTier } from '../../domain/layout';
import { fitParts, fits, measure, wrapWords } from '../../lib/textFit';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { type Patch } from '../plan/actions';
import { PATTERN_IDS } from '../plan/Patterns';
import { badgeLabel, segmentText, type SegmentText } from '../plan/segmentText';
import { num, sf } from '../../domain/format';
import { useHoverKeys } from '../../state/hoverStore';
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
const FONT_TINY = "600 11px Inter, 'Salesforce Sans', system-ui, sans-serif";
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

/** The numbered marker of a slice whose name is listed under the plate; its `t` is the number. */
const KEY_CLS = 'sp-seg__key';
const KEY_R = 8;

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

/**
 * Accessible name of a slice, from its facts alone: "Floor 8, Available now, Ste 860, 3,200 SF,
 * $31–$33/SF/yr FSG". It holds every line a slice can draw (WCAG 2.5.3) and does not depend on which of
 * them fit, so it is the same at every width and when the suite is selected (the inspector opening
 * narrows the plate). A numbered marker is decorative: its number follows the layout, and the entry
 * under the plate it points to says the same facts.
 */
export function sliceName(text: SegmentText): string {
  const floorName = text.aria.split(',')[0];
  // The short form a narrow slice draws ("Apr '28") is read too, so the drawn words are always in the name
  // (round 19: axe label-content-name-mismatch on Floor 7).
  const short = text.lensShort && !text.meta.includes(text.lensShort) ? text.lensShort : '';
  return [floorName, text.name, ...text.sub.split(' · '), text.meta, short, ...text.badges.map(badgeLabel)].filter(Boolean).join(', ');
}

type NameMode = 'name' | 'tiny' | 'none';
/** A rent with its unit and lease type: "$31–$33/SF/yr FSG". */
const isRate = (t: string) => /^\$\S+\/SF\/(yr|mo) \S+$/.test(t);
/** The rent a slice has to show, as written when it stands alone ("Asking" is dropped before anything else); '' when its fact is not a rent. */
export function rentOf(text: SegmentText): string {
  const plain = text.meta.replace(/^Asking /, '');
  return isRate(plain) ? plain : '';
}

/**
 * Candidate label lines for a slice whose usable label width is `fw` and bbox height `bh`.
 * A slice is short of width far more often than of height, so a fact that does not fit one line takes
 * another line rather than being dropped: the suite above the SF.
 *
 * A rent is the exception: it is one fact with its unit and lease type and is never broken inside
 * ("$31–$33/SF/yr" over a lone "FSG"). It takes a line whole, at 12 px or at 11 px, or it is left off
 * the slice, and `FloorPlate` then writes it in the numbered key under the plate.
 */
export function linesFor(text: SegmentText, tier: 0 | 1 | 2 | 3, fw: number, bh: number, mode: NameMode, nameLines: 1 | 2 = 2): Line[] {
  const lines: Line[] = [];
  const unit = `${text.sfShort} SF`;
  const budget = Math.max(1, Math.floor((bh - 2 * PAD) / LINE));
  const sub = (t: string, cls = 'sp-seg__sub'): Line => ({ t, cls, font: FONT_SUB });
  // Whole name or no name: a fragment ("Café") misleads more than it helps. Any labelled slice may wrap
  // the name once ("Preston Park" / "Café"); a name is never dropped from a slice that can hold it on two
  // lines. One that needs three, or has a word wider than the slice, gets a numbered marker instead and
  // is written out in the key under the plate (see `FloorPlate`), so the name is still on screen.
  // A state ("Available now") is one phrase, not a name: `nameLines` 1 keeps it on one line or off the slice.
  if (tier <= 2 && mode !== 'none') {
    const font = mode === 'name' ? FONT_NAME : FONT_TINY;
    const cls = mode === 'name' ? 'sp-seg__name' : 'sp-seg__tiny';
    const ls = wrapWords(text.name, fw, font, nameLines);
    // "Tenant · sublease" breaks at its separator, never leaving the dot at the end or start of a line.
    const parts = text.name.split(' · ');
    if (nameLines === 2 && ls.length === 2 && parts.length === 2 && parts.every((p) => fits(p, fw, font))) for (const l of parts) lines.push({ t: l, cls, font });
    else if (ls.length && ls.join(' ') === text.name) for (const l of ls) lines.push({ t: l, cls, font });
  }
  const named = lines.length > 0;
  // Suite and SF: on one line, else the suite above the SF; the SF figure is never dropped.
  const dot = text.sub.indexOf(' · ');
  const suite = dot > 0 && text.sub.startsWith('Ste ') ? text.sub.slice(0, dot) : '';
  // Under a name the SF is a plain fact; with no name it leads the label, in bold.
  const sfCls = named || tier <= 1 ? 'sp-seg__sub' : 'sp-seg__sf';
  if (tier <= 2 && fits(text.sub, fw, FONT_SUB)) lines.push(sub(text.sub));
  else if (tier <= 2 && suite && fits(suite, fw, FONT_SUB) && fits(unit, fw, FONT_SUB) && lines.length + 2 <= budget) lines.push(sub(suite), sub(unit, sfCls));
  else if (fits(unit, fw, FONT_SUB)) lines.push(sub(unit, sfCls));
  else if (fits(unit, fw, FONT_TINY)) lines.push({ t: unit, cls: 'sp-seg__small', font: FONT_TINY });
  // The lens line. A wide slice takes the full fact, a narrow one its short form or its rent. A rent is
  // shown whole (unit and lease type) on one line; other facts may lose trailing parts.
  const fact = tier <= 1 ? text.meta : tier === 2 ? text.lensShort || (text.meta.includes('$') ? text.meta : '') : '';
  let factDrawn = false;
  if (fact && lines.length) {
    const plain = fact.replace(/^Asking /, '');
    let fl: Line[] = [];
    if (fits(fact, fw, FONT_SUB)) fl = [sub(fact, 'sp-seg__meta')];
    else if (isRate(plain)) {
      if (fits(plain, fw, FONT_SUB)) fl = [sub(plain, 'sp-seg__meta')];
      else if (fits(plain, fw, FONT_TINY)) fl = [{ t: plain, cls: 'sp-seg__small', font: FONT_TINY }];
    } else {
      const short = fitParts(fact, fw, FONT_SUB);
      if (short.length >= 4) fl = [sub(short, 'sp-seg__meta')];
    }
    if (fl.length && lines.length + fl.length <= budget) {
      lines.push(...fl);
      factDrawn = true;
    }
  }
  // No name: the state in a word, or the lens fact ("Feb '27", "$32/SF/yr FSG"), under the SF, so colour
  // is never the only cue.
  if (!named && lines.length && !factDrawn) {
    const word = /^For sale/.test(text.name) ? 'For sale' : /^Available/.test(text.name) ? 'Available' : null;
    const short = text.lensShort || word;
    if (short) lines.push(fits(short, fw, FONT_SUB) ? sub(short, 'sp-seg__meta') : { t: short, cls: 'sp-seg__small', font: FONT_TINY });
  }
  return lines;
}

/**
 * Place lines centred on the slice. When every line fits between the same two edges the label shares
 * one centre line; in a slanted strip each line sits on the horizontal chord through its own centre,
 * so the label follows the strip instead of spilling over its edges.
 */
function placeLines(poly: Pt[], cy: number, lines: Line[]): PlacedLine[] {
  const layout = (ls: Line[]) => {
    const top = cy - (ls.length * LINE) / 2;
    const rows = ls.map((l, i) => {
      const c = chord(poly, top + i * LINE + LINE / 2);
      return { ...l, c, x: c ? (c[0] + c[1]) / 2 : NaN, y: top + i * LINE + 11, fitsHere: !!c && c[1] - c[0] - 2 * SIDE >= measure(l.t, l.font) };
    });
    // One centre line for the whole label when the edges common to every line leave room for the widest.
    const left = Math.max(...rows.map((r) => (r.c ? r.c[0] : Infinity)));
    const right = Math.min(...rows.map((r) => (r.c ? r.c[1] : -Infinity)));
    const widest = Math.max(0, ...rows.map((r) => measure(r.t, r.font)));
    if (rows.length > 1 && right - left - 2 * SIDE >= widest) for (const r of rows) r.x = (left + right) / 2;
    return rows;
  };
  const bare = ({ t, cls, font }: Line): Line => ({ t, cls, font });
  const placed = layout(lines);
  // A name line that does not fit its chord takes every name line with it: never a fragment.
  const isName = (cls: string) => cls === 'sp-seg__name' || cls === 'sp-seg__tiny';
  const nameFailed = placed.some((l) => isName(l.cls) && !l.fitsHere);
  // A lens fact or SF line that misses its chord at 12 px gets a second chance at 11 px (it says the state).
  const second = layout(placed.map((l) => (!l.fitsHere && !isName(l.cls) && l.font !== FONT_TINY ? { ...bare(l), font: FONT_TINY, cls: 'sp-seg__small' } : bare(l))));
  const kept = second.filter((l) => l.fitsHere && !(nameFailed && isName(l.cls)));
  return layout(kept.map(bare)).map(({ t, cls, font, x, y }) => ({ t, cls, font, x, y }));
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
  /** Its number in the key under the plate, when its name or its rent could not be drawn on the slice. */
  keyNo?: number;
  /** What the key writes for it (see `keyText`). */
  keyLabel?: string;
}

/** A tenant's name (it may wrap once), as against a state such as "Available now" (it never wraps). */
const tenantNamed = (seg: Segment, text: SegmentText): boolean =>
  !!seg.lease && text.name !== 'Tenant' && (seg.kind === 'leased' || seg.kind === 'holdover' || seg.kind === 'mtm' || seg.kind === 'sublease' || seg.kind === 'committed');

/**
 * Does a slice whose name is not drawn need an entry in the key? A tenant always does (a tenant name
 * is never dropped from the screen). So does any slice that shows no text, or only its suite and SF, so
 * colour is not its only cue. A vacancy that says "Available" (or its rent, or a date) already says what it is.
 */
function needsKey(seg: Segment, text: SegmentText, drawn: PlacedLine[], lobby: boolean): boolean {
  if (lobby) return false;
  // Nothing drawn, or only the suite and SF: nothing on the slice says what it is.
  if (!drawn.some((l) => !l.t.startsWith('Ste ') && !/ SF$/.test(l.t))) return true;
  return tenantNamed(seg, text);
}

/**
 * The key entry, built from the same parts for every marked slice: the name, the suite and SF, then the
 * rent when the slice had no room for it, whole. "① Available now · Ste 850 · 4,200 SF · $31–$33/SF/yr FSG",
 * "② Available now · Ste 860 · 3,200 SF · $31–$33/SF/yr FSG", "③ Preston Park Café · Ste 100 · 2,400 SF".
 */
export const keyText = (text: SegmentText, rent = ''): string => [text.name, text.sub, rent].filter(Boolean).join(' · ');

/** The floor plate: the footprint sliced into suites along its long axis, in lens tones. */
export function FloorPlate({ floor, model, state, patch, width, height }: FloorPlateProps) {
  const { property, safe, asOf } = model;
  const lens = state.lens;
  // The suites of the block the "Largest block" KPI reports carry its name as a badge.
  const largest = model.kpis.maxContiguous.keys;
  // A KPI or a finder row pointed at lights its suites here too, when this floor holds any of them;
  // pointing at space on another floor leaves this plate as it is.
  const hoverKeys = useHoverKeys();
  const highlight = hoverKeys && floor.segments.some((sg) => hoverKeys.has(sg.key)) ? hoverKeys : model.highlight;
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
    const out = segs.map((seg, i): Slice => {
      const poly = polys[i] ?? [];
      const pool = state.inquiry ? property.inquiries.filter((i) => i.id === state.inquiry) : property.inquiries;
      const matches = model.req && !safe ? inquiriesFor(seg, pool, asOf).length : 0;
      const text: SegmentText =
        seg.key === lobbyKey
          ? { tone: 'muted', pattern: 'hatch', name: 'Lobby · building use', sub: sf(seg.size), meta: 'Not leasable', badges: [], tooltip: `${floor.floor.name}: ${sf(seg.size)} non-leasable (lobby, loading, building use). Not counted in occupancy.`, aria: `${floor.floor.name}, lobby and building use, ${sf(seg.size)}, not leasable`, sfShort: num(seg.size), lensShort: '' }
          : segmentText(seg, { safe, asOf, today: model.today, lens, floorName: floor.floor.name, largest: largest.includes(seg.key), matches: matches || undefined, matchLabel: state.inquiry ? 'Fits this inquiry' : undefined });
      if (poly.length < 3 || polygonArea(poly) < 1) return { seg, text, poly, lines: [], badges: [], tier: 3 as const };
      const isLobby = seg.key === lobbyKey;
      const b = bbox(poly);
      const [, cy] = centroid(poly);
      const c = chord(poly, cy);
      const usable = Math.min(b.w, c ? c[1] - c[0] : 0);
      const tier = textTier(usable);
      // The whole name at 13 px, then at 11 px; failing both, no name and the state under the SF figure.
      const fw = usable - 2 * SIDE;
      const hasName = (ls: PlacedLine[]) => ls.some((l) => l.cls === 'sp-seg__name' || l.cls === 'sp-seg__tiny');
      const nameLines = tenantNamed(seg, text) ? 2 : 1;
      let cand = linesFor(text, tier, fw, b.h, 'name', nameLines);
      let lines = placeLines(poly, cy, cand);
      let keyed = false;
      const marker: Line = { t: '0', cls: KEY_CLS, font: FONT_TINY };
      /** With a numbered marker as the label's first line; a sliver too thin for even that line still gets it, at its centre. */
      const withMarker = (ls: Line[]): PlacedLine[] => {
        const out = placeLines(poly, cy, [marker, ...ls]);
        return out.some((l) => l.cls === KEY_CLS) ? out : [{ ...marker, x: c ? (c[0] + c[1]) / 2 : b.minX + b.w / 2, y: cy + 4 }, ...out];
      };
      if (!hasName(lines)) {
        const tinyCand = linesFor(text, tier, fw, b.h, 'tiny', nameLines);
        const tiny = placeLines(poly, cy, tinyCand);
        if (hasName(tiny)) {
          lines = tiny;
          cand = tinyCand;
        } else {
          // No room for the name at either size: the facts that do fit, under a numbered marker that the
          // key below the plate spells out. The marker is laid out as the label's first line.
          cand = linesFor(text, tier, fw, b.h, 'none');
          keyed = needsKey(seg, text, placeLines(poly, cy, cand), isLobby);
          lines = keyed ? withMarker(cand) : placeLines(poly, cy, cand);
        }
      }
      // A rent that found no room on the slice (it is never broken, and never dropped from the screen)
      // goes to the key, with the slice's name and suite, under the same kind of marker.
      const rent = isLobby ? '' : rentOf(text);
      const keyRent = rent && !lines.some((l) => l.t === rent || l.t === text.meta) ? rent : '';
      if (keyRent && !keyed) {
        keyed = true;
        lines = withMarker(cand);
      }
      const blockTop = lines.length ? lines[0].y - 11 : NaN;
      const badges = usable >= 120 ? placeBadges(poly, text, blockTop, cy) : [];
      const keyLabel = keyed ? keyText(text, keyRent) : undefined;
      return { seg, text, poly, lines, badges, tier, keyNo: keyed ? 0 : undefined, keyLabel };
    });
    // Number the keyed slices in plan order, left to right.
    let n = 0;
    for (const s of out) {
      if (s.keyNo === undefined) continue;
      s.keyNo = ++n;
      s.lines = s.lines.map((l) => (l.cls === KEY_CLS ? { ...l, t: String(n) } : l));
    }
    return out;
  }, [floor, points, model.req, property.inquiries, safe, asOf, lens, largest]);
  const keyed = slices.filter((s) => s.keyNo !== undefined);

  const focusAt = (i: number) => {
    const n = slices.length;
    if (!n) return;
    const next = ((i % n) + n) % n;
    setFocusIdx(next);
    refs.current[next]?.focus();
  };

  const onKey = (e: KeyboardEvent<SVGGElement>, i: number) => {
    if (e.key === 'Escape' && state.select) {
      e.preventDefault();
      patch({ select: null });
      return;
    }
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
        patch({ select: slices[i].seg.key, mode: 'building' });
        break;
    }
  };

  const selectedIdx = slices.findIndex((s) => s.seg.key === state.select);
  const tabStop = Math.min(focusIdx, Math.max(0, slices.length - 1));

  return (
    <>
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
            className={['sp-seg', selected ? 'is-selected' : '', dim ? 'is-dim' : '', p === 'dashed' ? 'sp-seg--dashed' : '', s.seg.key.endsWith('-lobby') ? 'sp-seg--lobby' : '', patternFill ? 'sp-seg--patterned' : ''].filter(Boolean).join(' ')}
            role={s.seg.key.endsWith('-lobby') ? 'img' : 'button'}
            tabIndex={s.seg.key.endsWith('-lobby') ? undefined : i === tabStop ? 0 : -1}
            aria-label={s.seg.key.endsWith('-lobby') ? s.text.aria : sliceName(s.text)}
            aria-pressed={s.seg.key.endsWith('-lobby') ? undefined : selected}
            data-key={s.seg.key}
            style={{ color: edge }}
            onClick={() => !s.seg.key.endsWith('-lobby') && patch({ select: s.seg.key, mode: 'building' })}
            onFocus={() => setFocusIdx(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <title>{s.text.tooltip}</title>
            <path className="sp-seg__ring" d={d} />
            <path className="sp-seg__rect" d={d} fill={fill} stroke={edge} />
            {patternFill && <path d={d} fill={patternFill} pointerEvents="none" />}
            {s.lines.map((l, j) =>
              l.cls === KEY_CLS ? (
                // The marker: a filled disc in the tone's text colour with the number knocked out in the fill.
                <g key={j} className={KEY_CLS} aria-hidden="true">
                  <circle cx={l.x} cy={l.y - 4} r={KEY_R} fill={color} />
                  <text x={l.x} y={l.y} textAnchor="middle" fill={fill}>
                    {`${l.t} `}
                  </text>
                </g>
              ) : (
                <text key={j} className={l.cls} x={l.x} y={l.y} fill={color} textAnchor="middle" style={patternFill ? { stroke: fill } : undefined}>
                  {`${l.t} `}
                </text>
              ),
            )}
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
      {selectedIdx >= 0 && slices[selectedIdx] && (
        // Drawn last so neighbouring slices never paint over the selection ring.
        <g className="sp-plate__selection" pointerEvents="none" aria-hidden="true">
          <path d={pathD(slices[selectedIdx].poly)} fill="none" stroke="var(--sp-color-brand)" strokeOpacity={0.25} strokeWidth={10} strokeLinejoin="round" />
          <path d={pathD(slices[selectedIdx].poly)} fill="none" stroke="var(--sp-color-brand)" strokeWidth={3} strokeLinejoin="round" />
        </g>
      )}
    </svg>
    {keyed.length > 0 && (
      // Names and rents the plate had no room for, directly under it, so each is on screen whole:
      // "1 Available now · Ste 850 · 4,200 SF · $31–$33/SF/yr FSG", "2 Available now · Ste 860 · 3,200 SF · $31–$33/SF/yr FSG".
      <ol className="sp-plate__key" aria-label={`${floor.floor.name}: names and rents not drawn on the plate`}>
        {keyed.map((s) => (
          <li key={s.seg.key}>
            <span className="sp-plate__key-n" aria-hidden="true">
              {s.keyNo}
            </span>
            <span className="sp-sr-only">{`Marker ${s.keyNo}: `}</span>
            {s.keyLabel}
          </li>
        ))}
      </ol>
    )}
    </>
  );
}
