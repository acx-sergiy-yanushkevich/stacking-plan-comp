import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { ISODate } from '../../domain/types';
import type { Segment } from '../../domain/derive';
import type { TimelineBar } from '../../domain/timeline';
import type { LensId } from '../../domain/lenses';
import { barSegment, dateToX, selectionKey } from '../../domain/timeline';
import { num, sf } from '../../domain/format';
import { fmtDate, fmtMonths, monthsBetween } from '../../domain/dates';
import { PATTERN_IDS } from '../plan/Patterns';
import { measure } from '../../lib/textFit';
import { requestFrame } from '../../lib/host';
import { BAR_HEIGHT, STACK_BAR_H, STACK_LABEL_GAP, STACK_LINE_H, stackedLaneHeight, type LaidOutRow } from './layout';
import { BAR_PAD, barLabel, EXT_PAD, labelText, MIN_NAMED_BAR, NAME_FONT, SUB_FONT, TAG_FONT, tagWidth, tenantOfEnded, VACATED, type LabelLine } from './barLabel';

const FADE_PX = 120;
/** The stacked chart is a third as wide, so an open-ended bar fades out over a shorter run. */
const STACK_FADE_PX = 48;
/** Bars that start before the axis run this far past the left edge so their corner is clipped square. */
const CLIP_OVERRUN = 8;

export interface BarHover {
  key: string;
  text: string;
  clientX: number;
  clientY: number;
}

export interface TimelineRowsProps {
  rows: LaidOutRow[];
  segIndex: Map<string, Segment>;
  start: ISODate;
  end: ISODate;
  asOf: ISODate;
  today: ISODate;
  lens: LensId;
  safe: boolean;
  plotLeft: number;
  plotWidth: number;
  /** Id of the clipPath covering the plot area. */
  clipId: string;
  highlight: Set<string> | null;
  selected: string | null;
  hovered: string | null;
  /**
   * Stacked chart (narrow hosts): the full label of every bar, wrapped to the plot width, keyed
   * by bar. Each is written above a thin bar instead of being fitted inside it. Null on the wide chart.
   */
  stacked?: Map<string, LabelLine[]> | null;
  onSelect: (segKey: string) => void;
  onHover: (h: BarHover | null) => void;
}

/** Floor name split into its word and number ("Floor 12" → ["Floor", "12"]); null for other names. */
function splitFloorName(name: string): [string, string] | null {
  const m = /^(\D+?)\s*(\S+)$/.exec(name.trim());
  return m && m[1] ? [m[1].trim(), m[2]] : null;
}

/** Whole " · "-separated parts of `text` that fit, in order; numbers are never cut mid-way. */
function fitParts(text: string, maxPx: number, font: string): string {
  const parts = text.split(' · ');
  let out = '';
  for (const part of parts) {
    const next = out ? `${out} · ${part}` : part;
    if (measure(next, font) > maxPx) break;
    out = next;
  }
  return out;
}

/** Trim `text` with an ellipsis until it fits `maxPx` in `font`. Only for names: never for numbers or dates. */
function ellipsize(text: string, maxPx: number, font: string): string {
  if (measure(text, font) <= maxPx) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(`${text.slice(0, mid).trimEnd()}…`, font) <= maxPx) lo = mid;
    else hi = mid - 1;
  }
  return lo < 2 ? '' : `${text.slice(0, lo).trimEnd()}…`;
}

export function TimelineRows({ rows, segIndex, start, end, asOf, today, lens, safe, plotLeft, plotWidth, clipId, highlight, selected, hovered, stacked = null, onSelect, onHover }: TimelineRowsProps) {
  // One tab stop for the whole chart: arrows move between bars (← → within a floor, ↑ ↓ across floors).
  const rootRef = useRef<SVGGElement | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const order = rows.map((r) => [...r.lanes.flat()].sort((a, b) => a.start.localeCompare(b.start)));
  const allKeys = order.flat().map((b) => b.key);
  const selectedBar = order.flat().find((b) => selected !== null && selectionKey(b) === selected)?.key ?? null;
  const activeKey = focusKey && allKeys.includes(focusKey) ? focusKey : (selectedBar ?? allKeys[0] ?? null);
  const focusBar = (key: string) => {
    setFocusKey(key);
    requestFrame(() => rootRef.current?.querySelector<SVGGElement>(`[data-bar="${CSS.escape(key)}"]`)?.focus());
  };
  const navigate = (key: string, dir: 'left' | 'right' | 'up' | 'down' | 'home' | 'end') => {
    const ri = order.findIndex((r) => r.some((b) => b.key === key));
    if (ri < 0) return;
    const bi = order[ri].findIndex((b) => b.key === key);
    let next: string | undefined;
    if (dir === 'right') next = order[ri][bi + 1]?.key;
    else if (dir === 'left') next = order[ri][bi - 1]?.key;
    else if (dir === 'down') next = order.slice(ri + 1).find((r) => r.length)?.[0]?.key;
    else if (dir === 'up') next = [...order.slice(0, ri)].reverse().find((r) => r.length)?.[0]?.key;
    else if (dir === 'home') next = order[ri][0]?.key;
    else if (dir === 'end') next = order[ri].at(-1)?.key;
    if (next) focusBar(next);
  };
  const X = (d: ISODate) => plotLeft + Math.min(plotWidth, Math.max(0, dateToX(d, start, end, plotWidth)));
  const cursorX = X(asOf);
  const plotRight = plotLeft + plotWidth;
  const gutterX = stacked ? 2 : 10;

  return (
    <g className={`sp-tl-rows ${stacked ? 'sp-tl-rows--stacked' : ''}`} ref={rootRef}>
      {rows.map(({ row, lanes, laneTop, top: y, height }) => {
        const parts = splitFloorName(row.floor.name);
        const leasable = row.floor.size - row.floor.nonLeasable;
        return (
          <g key={row.floor.id} className="sp-tl-row" data-floor={row.floor.id}>
            <line className="sp-tl-row__rule" x1={0} x2={plotRight} y1={y + height - 0.5} y2={y + height - 0.5} />
            <g className="sp-tl-row__gutter">
              <title>{`${row.floor.name} · ${sf(leasable)} leasable`}</title>
              <text className="sp-tl-row__name" x={gutterX} y={y + 15}>
                {parts ? (
                  <>
                    <tspan className="sp-tl-row__word">{parts[0]} </tspan>
                    <tspan className="sp-tl-row__num">{parts[1]}</tspan>
                  </>
                ) : (
                  <tspan className="sp-tl-row__num">{ellipsize(row.floor.name, plotLeft - gutterX - 6, '600 13px Inter, system-ui, sans-serif')}</tspan>
                )}
              </text>
              <text className="sp-tl-row__rsf" x={gutterX} y={y + 27}>
                {num(leasable)} SF
              </text>
            </g>
            {row.bars.length === 0 ? (
              <text className="sp-tl-row__empty" x={plotLeft + 8} y={y + height / 2 + 4}>
                No leases or availabilities
              </text>
            ) : (
              <g clipPath={`url(#${clipId})`}>
                {lanes.map((lane, li) =>
                  lane.map((bar) => {
                    const seg = barSegment(bar, segIndex);
                    if (!seg) return null;
                    const nextStart = lane.filter((b) => b.start > bar.start).map((b) => b.start).sort()[0];
                    const freeRight = nextStart ? X(nextStart) : plotRight;
                    return (
                      <Bar
                        key={bar.key}
                        bar={bar}
                        seg={seg}
                        freeRight={freeRight}
                        focusable={activeKey === bar.key}
                        onFocusBar={() => setFocusKey(bar.key)}
                        onNavigate={(dir) => navigate(bar.key, dir)}
                        floorName={row.floor.name}
                        y={y + laneTop[li]}
                        X={X}
                        lines={stacked ? (stacked.get(bar.key) ?? []) : null}
                        plotLeft={plotLeft}
                        clippedStart={bar.start < start}
                        cursorX={cursorX}
                        plotRight={plotRight}
                        asOf={asOf}
                        today={today}
                        lens={lens}
                        safe={safe}
                        dim={highlight !== null && !highlight.has(bar.segKey)}
                        selected={selected !== null && selectionKey(bar) === selected}
                        hovered={hovered === bar.key}
                        onSelect={onSelect}
                        onHover={onHover}
                      />
                    );
                  }),
                )}
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

interface BarProps {
  bar: TimelineBar;
  seg: Segment;
  floorName: string;
  y: number;
  X: (d: ISODate) => number;
  clippedStart: boolean;
  cursorX: number;
  plotRight: number;
  asOf: ISODate;
  today: ISODate;
  lens: LensId;
  safe: boolean;
  /** Pixel x where the next bar in this lane starts (label may spill into the gap). */
  freeRight: number;
  /** Stacked chart: the wrapped label written above the bar. Null on the wide chart. */
  lines: LabelLine[] | null;
  plotLeft: number;
  focusable: boolean;
  onFocusBar: () => void;
  onNavigate: (dir: 'left' | 'right' | 'up' | 'down' | 'home' | 'end') => void;
  dim: boolean;
  selected: boolean;
  hovered: boolean;
  onSelect: (segKey: string) => void;
  onHover: (h: BarHover | null) => void;
}

function Bar({ bar, seg, floorName, y, X, clippedStart, cursorX, plotRight, asOf, today, lens, safe, freeRight, lines, plotLeft, focusable, onFocusBar, onNavigate, dim, selected, hovered, onSelect, onHover }: BarProps) {
  const { text, name, sub, risk } = barLabel(bar, seg, { safe, asOf, lens, floorName, today });
  const isMkt = bar.key.endsWith('-mkt');
  // Coming supply is availability, so it takes the available-later tone in every lens, never the lease's.
  const tone = isMkt ? 'available-later' : text.tone;
  const fill = `var(--tone-${tone}-fill)`;
  const edge = `var(--tone-${tone}-edge)`;
  const ink = `var(--tone-${tone}-text)`;
  const isAvail = bar.kind === 'available' || bar.kind === 'forsale';
  // Prospects never see tenant risk: in safe mode holdover and MTM draw as plain leases ending at the cursor.
  const isMtm = bar.kind === 'mtm' && !safe;
  const isHoldover = bar.kind === 'holdover' && !safe;
  const safeRisk = safe && (bar.kind === 'mtm' || bar.kind === 'holdover');
  const isProjected = bar.kind === 'projected';
  const fade = lines ? STACK_FADE_PX : FADE_PX;

  // Geometry. A bar that began before the axis overruns the left edge; the clipPath squares it off.
  const visibleX0 = X(bar.start);
  const x0 = clippedStart ? visibleX0 - CLIP_OVERRUN : visibleX0;
  let x1: number;
  if (isAvail) x1 = plotRight;
  else if (isMtm) x1 = Math.min(plotRight, Math.max(cursorX, visibleX0 + 24) + fade);
  // Prospect-safe: the term is not disclosed, so the bar runs past the cursor and fades like an
  // open-ended lease (neutral tone, no tag), instead of stopping dead on the as-of line.
  else if (safeRisk) x1 = Math.min(plotRight, Math.max(cursorX, visibleX0 + 24) + fade);
  else x1 = bar.end ? X(bar.end) : plotRight;
  const w = Math.max(2, x1 - x0);
  const visibleW = x1 - visibleX0;
  const extW = (isHoldover || isProjected) && cursorX > x1 ? cursorX - x1 : 0;

  // Full facts for the tooltip: exact dates and months remaining.
  const dates = isAvail
    ? bar.start > asOf
      ? `Available from ${fmtDate(bar.start)} · no end date`
      : 'Available now · no end date'
    : bar.datesWithheld
      ? // Prospect-safe: the bar's ends are the chart's, not the lease's. No date is printed for it.
        bar.committed
        ? 'Signed, not in'
        : 'Leased'
      : `${fmtDate(bar.start)} – ${bar.end ? fmtDate(bar.end) : 'open-ended (no end date)'}${bar.end && !isHoldover && !isProjected && bar.kind !== 'committed' ? ` · ${fmtMonths(Math.max(0, monthsBetween(asOf, bar.end)))} left` : ''}`;
  const tooltip = `${text.tooltip}\n${dates}`;

  const gradId = `sp-tl-fade-${bar.key}`;
  const faded = isMtm || isAvail || safeRisk;
  const classes = ['sp-seg', 'sp-tl-bar', `sp-tl-bar--${bar.kind}`, lines ? 'sp-tl-bar--stacked' : '', text.pattern === 'dashed' || isMkt ? 'sp-seg--dashed' : '', clippedStart ? 'is-clipped' : '', dim ? 'is-dim' : '', selected ? 'is-selected' : ''].filter(Boolean).join(' ');

  // A tap already opens the inspector with the full facts; a floating tip under the finger only gets in the way.
  const hover = (e: PointerEvent<SVGGElement>) => {
    if (e.pointerType !== 'touch') onHover({ key: bar.key, text: tooltip, clientX: e.clientX, clientY: e.clientY });
  };
  // An ended lease selects nothing (`selectionKey`): it stays in the arrow-key order, so its tooltip and
  // accessible name can be read, but it is marked unavailable rather than offered as a toggle.
  const target = selectionKey(bar);
  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    const dirs: Record<string, 'left' | 'right' | 'up' | 'down' | 'home' | 'end'> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Home: 'home', End: 'end' };
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (target) onSelect(target);
    } else if (e.key === 'Escape' && selected && target) {
      e.preventDefault();
      onSelect(target); // toggles the selection off (see TimelineView.onSelect)
    } else if (dirs[e.key]) {
      e.preventDefault();
      onNavigate(dirs[e.key]);
    }
  };
  /** The interactive shell shared by both charts: one button per bar. */
  const shell = (aria: string) => ({
    className: classes,
    role: 'button',
    tabIndex: focusable ? 0 : -1,
    'aria-label': aria,
    ...(target ? { 'aria-pressed': selected } : { 'aria-disabled': true }),
    'data-seg': bar.segKey,
    'data-bar': bar.key,
    style: { color: edge },
    onClick: () => {
      if (target) onSelect(target);
    },
    onKeyDown,
    onPointerEnter: hover,
    onPointerMove: hover,
    onPointerLeave: () => onHover(null),
    onFocus: () => {
      onFocusBar();
      onHover({ key: bar.key, text: tooltip, clientX: Number.NaN, clientY: Number.NaN });
    },
    onBlur: () => onHover(null),
  });
  /** The bar itself (fill, pattern overlays, holdover and projected extensions) at `top`, `h` tall. */
  const body = (top: number, h: number) => (
    <>
      {faded && (
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={x1 - fade} x2={x1} y1={0} y2={0}>
            <stop offset="0" stopColor="#fff" stopOpacity={1} />
            <stop offset="1" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
          <mask id={`${gradId}-mask`} maskUnits="userSpaceOnUse" x={x0 - 2} y={top - 2} width={w + 4} height={h + 4}>
            <rect x={x0 - 2} y={top - 2} width={w + 4} height={h + 4} fill={`url(#${gradId})`} />
          </mask>
        </defs>
      )}
      {selected && <rect className="sp-seg__ring" x={x0 - 2} y={top - 2} width={w + extW + 4} height={h + 4} rx={5} />}
      <g mask={faded ? `url(#${gradId}-mask)` : undefined}>
        <rect className="sp-seg__rect" x={x0 + 0.5} y={top + 0.5} width={rectW} height={h - 1} rx={3} fill={fill} stroke={edge} />
        {bar.committed && <rect className="sp-seg__overlay" x={x0 + 0.5} y={top + 0.5} width={rectW} height={h - 1} rx={3} fill={`url(#${PATTERN_IDS.hatch})`} />}
        {bar.sublease && <rect className="sp-seg__overlay" x={x0 + 0.5} y={top + 0.5} width={rectW} height={h - 1} rx={3} fill={`url(#${PATTERN_IDS.dots})`} />}
      </g>
      {extW > 0 && isHoldover && <rect className="sp-tl-bar__ext sp-tl-bar__ext--risk" x={x1 - 0.5} y={top + 0.5} width={extW} height={h - 1} rx={3} />}
      {extW > 0 && isProjected && <rect className="sp-tl-bar__ext sp-tl-bar__ext--projected" x={x1 - 0.5} y={top + 0.5} width={extW} height={h - 1} rx={3} stroke={edge} />}
    </>
  );
  const rectW = Math.max(1, w - 1);

  // Stacked chart: the whole label on its own line(s) above a thin bar. Nothing is fitted, so nothing is cut.
  if (lines) {
    const tagW = risk ? tagWidth(risk) : 0;
    const barTop = y + lines.length * STACK_LINE_H + STACK_LABEL_GAP;
    const aria = `${[risk, labelText(lines)].filter(Boolean).join(' ')}. ${text.aria}. ${dates}`;
    return (
      <g {...shell(aria)}>
        {!hovered && <title>{tooltip}</title>}
        {/* The whole lane is the target: a 12 px bar is too small for a finger. */}
        <rect className="sp-tl-bar__lane" x={plotLeft} y={y - 4} width={plotRight - plotLeft} height={stackedLaneHeight(lines.length) + 8} rx={4} />
        {body(barTop, STACK_BAR_H)}
        {risk && (
          <g className="sp-tl-tag sp-tl-tag--risk" aria-hidden="true">
            <rect x={plotLeft + 2} y={y} width={tagW} height={14} rx={3} />
            <text x={plotLeft + 2 + tagW / 2} y={y + 11} textAnchor="middle">
              {`${risk} `}
            </text>
          </g>
        )}
        {lines.map((line, i) => (
          <text key={i} className="sp-tl-bar__text sp-tl-bar__text--outside" x={plotLeft + 2 + (i === 0 && risk ? tagW + 5 : 0)} y={y + 11 + i * STACK_LINE_H}>
            {line.map((run, ri) => (
              <tspan key={ri} className={run.kind === 'name' ? 'sp-tl-bar__name' : 'sp-tl-bar__sub'}>
                {/* A line ends in a space, so a label wrapped over two lines reads "Ste 720 7,000 SF" to
                    assistive technology as it does in the bar's accessible name, not "Ste 7207,000 SF". */}
                {ri === line.length - 1 ? `${run.text} ` : run.text}
              </tspan>
            ))}
          </text>
        ))}
      </g>
    );
  }

  // Tags sit at the bar's start; the label moves right to make room.
  let tagText: string | null = risk === 'MTM' ? 'MTM' : risk === 'Holdover' && extW > 0 ? 'Holdover' : null;
  const labelPad = BAR_PAD / 2;
  // A label is written inside the bar itself and never across its end. A holdover and a lease that has
  // ended are drawn on to the as-of line as a second box (the extension); a label that ran from one box
  // into the other had the bar's end edge drawn through its words ("Argosy|Partners").
  const barEnd = (isMtm || safeRisk ? x1 - FADE_PX / 2 : x1) - labelPad;
  const nameW = measure(name, NAME_FONT);
  const sepW = measure(' · ', SUB_FONT);
  // The extension is the bar's own ground (rose for a holdover, a dashed box for an ended lease).
  const extRoom = Math.max(0, extW - EXT_PAD);
  // The tag must fit the bar; and the tenant name outranks it: if both cannot fit, drop the tag (the
  // rose extension, the trailing tag and the tooltip still say holdover / MTM) rather than leave an
  // unnamed at-risk bar. A holdover counts its extension as room here: its tag stays at the start of the
  // bar while the two fit the bar and the extension together, and the name is then placed below.
  {
    const end0 = barEnd + (isHoldover ? extW : 0);
    const tagW0 = tagText ? Math.ceil(measure(tagText, TAG_FONT)) + 10 : 0;
    const roomWithTag = end0 - (visibleX0 + labelPad + (tagText ? tagW0 + 4 : 0));
    const roomWithout = end0 - (visibleX0 + labelPad);
    const nm = isAvail ? bar.label : text.name;
    if (tagText && isHoldover && visibleW < tagW0 + 8) tagText = null;
    else if (tagText && measure(nm, NAME_FONT) > roomWithTag && measure(nm, NAME_FONT) <= roomWithout) tagText = null; // the trailing tag below keeps the state visible
  }
  const tagW = tagText ? Math.ceil(measure(tagText, TAG_FONT)) + 10 : 0;
  const tagX = tagText ? visibleX0 + 4 : 0;
  const textX = visibleX0 + labelPad + (tagText ? tagW + 4 : 0);
  const textRoom = barEnd - textX;

  // Label tiers by visible width: the <title> and aria-label always carry the full text.
  // The name is shown whole or not at all: a partial tenant name misleads, and a name that says a state
  // ("Kinetic Ventures · vacated", "Infinity Info Systems · sublease") must not lose the state's word.
  // The facts after it (suite, SF) are whole " · " parts, as many as fit.
  const subFor = (room: number) => {
    const rest = room - nameW - sepW;
    return rest > 24 ? fitParts(sub, rest, SUB_FONT) : '';
  };
  const sfOnly = measure(`${text.sfShort} SF`, NAME_FONT) <= textRoom ? `${text.sfShort} SF` : measure(text.sfShort, NAME_FONT) <= textRoom ? text.sfShort : '';
  // Where the label goes: inside the bar, inside its extension, or in the free lane to its right. An ended
  // lease's label that fits neither its bar nor its dashed box starts at the bar's end all the same
  // ('after') and runs on across the as-of line: written right of the line, it sat years from its bar.
  let place: 'bar' | 'ext' | 'outside' | 'after' = 'bar';
  let nameText = '';
  let subText = '';
  if (visibleW >= MIN_NAMED_BAR && nameW <= textRoom) {
    nameText = name;
    subText = subFor(textRoom);
  }
  // The trailing tag needs free lane to its right; otherwise the rose extension and the tooltip carry the state.
  const trailingWord = isMtm ? 'MTM' : 'Holdover';
  const trailingW = Math.ceil(measure(trailingWord, TAG_FONT)) + 10;
  // Room to the right must also hold the trailing Holdover / MTM tag, which is drawn there first.
  const trailingNeed = !tagText && !safe && (isHoldover || isMtm) ? trailingW + 6 : 0;
  const outsideRoom = isAvail ? 0 : freeRight - (x1 + extW) - 10 - trailingNeed;
  // A label that fits inside only without its suite or SF moves out whole when the lane to the right is free.
  // An ended lease's name stays on its own bar: the right of the lane is past the as-of line, away from it.
  const cut = nameText === name && subText !== sub;
  if (name && !isAvail && (!nameText || (cut && plotRight >= 800 && !isProjected))) {
    const wholeW = nameW + sepW + measure(sub, SUB_FONT);
    // An ended lease writes its label in the dashed box straight after its bar, never beyond the as-of
    // line; a holdover keeps its name beside its tag, on the rose extension, when the whole label fits there.
    const order: Array<'ext' | 'outside'> = isProjected ? ['ext'] : isHoldover ? ['ext', 'outside'] : ['outside', 'ext'];
    const roomOf = (where: 'ext' | 'outside') => (where === 'ext' ? extRoom : outsideRoom);
    // First a place that holds the whole label; failing that, when the bar holds no name at all, the roomiest place that holds the name.
    const whole = order.find((where) => wholeW <= roomOf(where));
    const named = nameText ? undefined : order.filter((where) => nameW <= roomOf(where)).sort((a, b) => roomOf(b) - roomOf(a))[0];
    const where = whole ?? named;
    if (where) {
      place = where;
      nameText = name;
      subText = subFor(roomOf(where));
    }
  }
  // An ended lease whose whole name fits nowhere: the tenant in the bar and the word in the dashed box
  // after it, which is the time since the tenant left. The bar's end stands between the two, not in one.
  // (Where not even that fits, the bar has kept its lane and the label is on the right: `endedNameFits`.)
  const tenantOnly = isProjected ? tenantOfEnded(name) : null;
  let extWord = '';
  if (!nameText && tenantOnly !== null && visibleW >= MIN_NAMED_BAR && measure(tenantOnly, NAME_FONT) <= textRoom && measure(VACATED, NAME_FONT) <= extRoom) {
    nameText = tenantOnly;
    extWord = VACATED;
  }
  // An ended lease too short for all of that: the whole name from the bar's end, across the as-of line. The
  // bar has kept the rest of its lane for it (`endedNameFits`, `packLanes`), so nothing else is drawn there.
  if (!nameText && isProjected && name) {
    place = 'after';
    nameText = name;
    subText = subFor(freeRight - (x1 + 6) - 10);
  }
  // Last resort, a bar too narrow for any of that: as much of the name as fits in whole parts, else the SF.
  if (!nameText && textRoom > 0) {
    if (visibleW >= MIN_NAMED_BAR) nameText = fitParts(name, textRoom, NAME_FONT) || sfOnly;
    else if (visibleW >= 48) nameText = sfOnly;
    // A tagged bar (Holdover / MTM) must always say who: prefer the tenant name over the SF figure.
    if (tagText && nameText === sfOnly && name && nameW <= textRoom) nameText = name;
  }
  const outside = place === 'outside';
  const trailingTag = !tagText && !safe && (isHoldover || isMtm) && freeRight - (x1 + extW) >= trailingW + 8 ? trailingWord : null;
  const labelX = place === 'outside' ? x1 + extW + 6 + (trailingTag ? trailingW + 6 : 0) : place === 'ext' || place === 'after' ? x1 + 6 : textX;
  // On the card (right of the bar, or in an ended lease's dashed box) the label is in the card's text colour; on a fill it is in the tone's.
  const onCard = outside || place === 'after' || (place === 'ext' && isProjected);
  // DOM order: the (trailing) tag group is rendered before the label text, so the accessible name must match that order.
  // It says the whole name whenever any of it is on screen, so an ended lease is "vacated" to a screen reader as well.
  const visibleLabel = extWord || (nameText && nameText !== sfOnly && nameText !== name) ? [name, subText].filter(Boolean).join(' · ') : [nameText, subText].filter(Boolean).join(' · ');
  const visibleText = [tagText ?? trailingTag, visibleLabel || (isProjected ? name : '')].filter(Boolean).join(' ');
  const aria = `${visibleText ? `${visibleText}. ` : ''}${text.aria}. ${dates}`;

  return (
    <g {...shell(aria)}>
      {!hovered && <title>{tooltip}</title>}
      {body(y, BAR_HEIGHT)}
      {trailingTag && (
        <g className="sp-tl-tag sp-tl-tag--risk" aria-hidden="true">
          <rect x={x1 + extW + 4} y={y + 3} width={trailingW} height={16} rx={3} />
          <text x={x1 + extW + 4 + trailingW / 2} y={y + 15} textAnchor="middle">
            {`${trailingTag} `}
          </text>
        </g>
      )}
      {tagText && (
        <g className="sp-tl-tag sp-tl-tag--risk" aria-hidden="true">
          <rect x={tagX} y={y + 3} width={tagW} height={16} rx={3} />
          <text x={tagX + tagW / 2} y={y + 15} textAnchor="middle">
            {`${tagText} `}
          </text>
        </g>
      )}
      {nameText && place === 'bar' && (bar.committed || bar.sublease) && (
        <rect x={textX - 4} y={y + 3} width={Math.ceil(measure(nameText, NAME_FONT) + (subText ? measure(` · ${subText}`, SUB_FONT) : 0)) + 8} height={BAR_HEIGHT - 6} rx={3} fill="var(--sp-color-card)" fillOpacity={0.92} pointerEvents="none" />
      )}
      {nameText && (
        <text className={`sp-tl-bar__text ${onCard ? 'sp-tl-bar__text--outside' : ''}`} data-place={place} x={labelX} y={y + BAR_HEIGHT / 2 + 4} fill={onCard ? 'var(--sp-color-text)' : ink} style={{ paintOrder: 'stroke', stroke: onCard ? 'var(--sp-color-card)' : place === 'ext' ? 'var(--tone-risk-fill)' : fill, strokeWidth: 3, strokeLinejoin: 'round' }}>
          <tspan className="sp-tl-bar__name">{nameText}</tspan>
          {subText && <tspan className="sp-tl-bar__sub"> · {subText}</tspan>}
        </text>
      )}
      {extWord && (
        <text className="sp-tl-bar__text sp-tl-bar__text--outside" data-place="ext" x={x1 + 6} y={y + BAR_HEIGHT / 2 + 4} fill="var(--sp-color-text)" style={{ paintOrder: 'stroke', stroke: 'var(--sp-color-card)', strokeWidth: 3, strokeLinejoin: 'round' }}>
          <tspan className="sp-tl-bar__name">{extWord}</tspan>
        </text>
      )}
    </g>
  );
}
