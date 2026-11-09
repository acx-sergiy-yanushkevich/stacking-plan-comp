import type { KeyboardEvent, PointerEvent } from 'react';
import type { ISODate } from '../../domain/types';
import type { Segment } from '../../domain/derive';
import type { TimelineBar } from '../../domain/timeline';
import type { LensId } from '../../domain/lenses';
import { dateToX } from '../../domain/timeline';
import { num, sf } from '../../domain/format';
import { fmtDate, fmtMonths, monthsBetween } from '../../domain/dates';
import { segmentText } from '../plan/segmentText';
import { PATTERN_IDS } from '../plan/Patterns';
import { measure } from '../../lib/textFit';
import { BAR_HEIGHT, LANE_PITCH, ROW_PAD, type LaidOutRow } from './layout';

const FADE_PX = 120;
/** Bars that start before the axis run this far past the left edge so their corner is clipped square. */
const CLIP_OVERRUN = 8;
const NAME_FONT = '600 12px Inter, system-ui, sans-serif';
const SUB_FONT = '11px Inter, system-ui, sans-serif';
const TAG_FONT = '600 11px Inter, system-ui, sans-serif';

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
  lens: LensId;
  safe: boolean;
  plotLeft: number;
  plotWidth: number;
  /** Id of the clipPath covering the plot area. */
  clipId: string;
  highlight: Set<string> | null;
  selected: string | null;
  hovered: string | null;
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

export function TimelineRows({ rows, segIndex, start, end, asOf, lens, safe, plotLeft, plotWidth, clipId, highlight, selected, hovered, onSelect, onHover }: TimelineRowsProps) {
  const X = (d: ISODate) => plotLeft + Math.min(plotWidth, Math.max(0, dateToX(d, start, end, plotWidth)));
  const cursorX = X(asOf);
  const plotRight = plotLeft + plotWidth;

  return (
    <g className="sp-tl-rows">
      {rows.map(({ row, lanes, top: y, height }) => {
        const parts = splitFloorName(row.floor.name);
        const leasable = row.floor.size - row.floor.nonLeasable;
        return (
          <g key={row.floor.id} className="sp-tl-row" data-floor={row.floor.id}>
            <line className="sp-tl-row__rule" x1={0} x2={plotRight} y1={y + height - 0.5} y2={y + height - 0.5} />
            <g className="sp-tl-row__gutter">
              <title>{`${row.floor.name} · ${sf(leasable)} leasable`}</title>
              <text className="sp-tl-row__name" x={10} y={y + 15}>
                {parts ? (
                  <>
                    <tspan className="sp-tl-row__word">{parts[0]} </tspan>
                    <tspan className="sp-tl-row__num">{parts[1]}</tspan>
                  </>
                ) : (
                  <tspan className="sp-tl-row__num">{ellipsize(row.floor.name, plotLeft - 16, '600 13px Inter, system-ui, sans-serif')}</tspan>
                )}
              </text>
              <text className="sp-tl-row__rsf" x={10} y={y + 27}>
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
                    const seg = segIndex.get(bar.segKey);
                    if (!seg) return null;
                    return (
                      <Bar
                        key={bar.key}
                        bar={bar}
                        seg={seg}
                        floorName={row.floor.name}
                        y={y + ROW_PAD + li * LANE_PITCH}
                        X={X}
                        clippedStart={bar.start < start}
                        cursorX={cursorX}
                        plotRight={plotRight}
                        asOf={asOf}
                        lens={lens}
                        safe={safe}
                        dim={highlight !== null && !highlight.has(bar.segKey)}
                        selected={selected === bar.segKey}
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
  lens: LensId;
  safe: boolean;
  dim: boolean;
  selected: boolean;
  hovered: boolean;
  onSelect: (segKey: string) => void;
  onHover: (h: BarHover | null) => void;
}

function Bar({ bar, seg, floorName, y, X, clippedStart, cursorX, plotRight, asOf, lens, safe, dim, selected, hovered, onSelect, onHover }: BarProps) {
  const text = segmentText(seg, { safe, asOf, lens, floorName });
  const tone = text.tone;
  const fill = `var(--tone-${tone}-fill)`;
  const edge = `var(--tone-${tone}-edge)`;
  const ink = `var(--tone-${tone}-text)`;
  const isAvail = bar.kind === 'available' || bar.kind === 'forsale';
  const isMtm = bar.kind === 'mtm';
  const isHoldover = bar.kind === 'holdover';
  const isProjected = bar.kind === 'projected';

  // Geometry. A bar that began before the axis overruns the left edge; the clipPath squares it off.
  const visibleX0 = X(bar.start);
  const x0 = clippedStart ? visibleX0 - CLIP_OVERRUN : visibleX0;
  let x1: number;
  if (isAvail) x1 = plotRight;
  else if (isMtm) x1 = Math.min(plotRight, Math.max(cursorX, visibleX0 + 24) + FADE_PX);
  else x1 = bar.end ? X(bar.end) : plotRight;
  const w = Math.max(2, x1 - x0);
  const visibleW = x1 - visibleX0;
  const extW = (isHoldover || isProjected) && cursorX > x1 ? cursorX - x1 : 0;

  // Tags sit at the bar's start; the label moves right to make room.
  const tagText = isMtm ? 'MTM' : isHoldover && extW > 0 ? 'Holdover' : null;
  const tagW = tagText ? Math.ceil(measure(tagText, TAG_FONT)) + 10 : 0;
  const tagX = tagText ? visibleX0 + 4 : 0;
  const labelPad = 8;
  const textX = visibleX0 + labelPad + (tagText ? tagW + 4 : 0);
  const textEnd = (isMtm ? x1 - FADE_PX / 2 : x1 + (isHoldover ? extW : 0)) - labelPad;
  const textRoom = textEnd - textX;

  // Label tiers by visible width: the <title> and aria-label always carry the full text.
  const name = isAvail ? bar.label : text.name;
  const sub = isAvail ? `${sf(seg.size)}${text.meta ? ` · ${text.meta}` : ''}` : text.sub;
  // Names with digits ("Vacates Apr '27", "Available · Ste 1250") are shown whole or not at all.
  const fitName = (room: number) => (/\d/.test(name) ? (measure(name, NAME_FONT) <= room ? name : fitParts(name, room, NAME_FONT)) : ellipsize(name, room, NAME_FONT));
  const sfOnly = measure(text.sfShort, NAME_FONT) <= textRoom ? text.sfShort : '';
  let nameText = '';
  let subText = '';
  if (visibleW >= 180 && textRoom > 0) {
    nameText = fitName(textRoom) || sfOnly;
    const rest = textRoom - measure(nameText, NAME_FONT) - measure(' · ', SUB_FONT);
    subText = nameText && rest > 24 ? fitParts(sub, rest, SUB_FONT) : '';
  } else if (visibleW >= 90 && textRoom > 0) {
    nameText = fitName(textRoom) || sfOnly;
  } else if (visibleW >= 48 && textRoom > 0) {
    nameText = sfOnly;
  }

  // Full facts for the tooltip: exact dates and months remaining.
  const dates = isAvail
    ? bar.start > asOf
      ? `Available from ${fmtDate(bar.start)}`
      : 'Available now'
    : `${fmtDate(bar.start)} – ${bar.end ? fmtDate(bar.end) : 'open-ended'}${bar.end && !isHoldover && !isProjected && bar.kind !== 'committed' ? ` · ${fmtMonths(Math.max(0, monthsBetween(asOf, bar.end)))} left` : ''}`;
  const tooltip = `${text.tooltip}\n${dates}`;
  const aria = `${text.aria}. ${dates}`;

  const gradId = `sp-tl-fade-${bar.key}`;
  const classes = ['sp-seg', 'sp-tl-bar', `sp-tl-bar--${bar.kind}`, text.pattern === 'dashed' ? 'sp-seg--dashed' : '', clippedStart ? 'is-clipped' : '', dim ? 'is-dim' : '', selected ? 'is-selected' : ''].filter(Boolean).join(' ');

  const hover = (e: PointerEvent<SVGGElement>) => onHover({ key: bar.key, text: tooltip, clientX: e.clientX, clientY: e.clientY });
  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(bar.segKey);
    }
  };

  const rectW = Math.max(1, w - 1);
  return (
    <g
      className={classes}
      role="button"
      tabIndex={0}
      aria-label={aria}
      aria-pressed={selected}
      data-seg={bar.segKey}
      style={{ color: edge }}
      onClick={() => onSelect(bar.segKey)}
      onKeyDown={onKeyDown}
      onPointerEnter={hover}
      onPointerMove={hover}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover({ key: bar.key, text: tooltip, clientX: Number.NaN, clientY: Number.NaN })}
      onBlur={() => onHover(null)}
    >
      {!hovered && <title>{tooltip}</title>}
      {isMtm && (
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={x1 - FADE_PX} x2={x1} y1={0} y2={0}>
            <stop offset="0" stopColor="#fff" stopOpacity={1} />
            <stop offset="1" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
          <mask id={`${gradId}-mask`} maskUnits="userSpaceOnUse" x={x0 - 2} y={y - 2} width={w + 4} height={BAR_HEIGHT + 4}>
            <rect x={x0 - 2} y={y - 2} width={w + 4} height={BAR_HEIGHT + 4} fill={`url(#${gradId})`} />
          </mask>
        </defs>
      )}
      {selected && <rect className="sp-seg__ring" x={x0 - 2} y={y - 2} width={w + extW + 4} height={BAR_HEIGHT + 4} rx={5} />}
      <g mask={isMtm ? `url(#${gradId}-mask)` : undefined}>
        <rect className="sp-seg__rect" x={x0 + 0.5} y={y + 0.5} width={rectW} height={BAR_HEIGHT - 1} rx={3} fill={fill} stroke={edge} />
        {bar.committed && <rect className="sp-seg__overlay" x={x0 + 0.5} y={y + 0.5} width={rectW} height={BAR_HEIGHT - 1} rx={3} fill={`url(#${PATTERN_IDS.hatch})`} />}
        {bar.sublease && <rect className="sp-seg__overlay" x={x0 + 0.5} y={y + 0.5} width={rectW} height={BAR_HEIGHT - 1} rx={3} fill={`url(#${PATTERN_IDS.dots})`} />}
      </g>
      {extW > 0 && isHoldover && <rect className="sp-tl-bar__ext sp-tl-bar__ext--risk" x={x1 - 0.5} y={y + 0.5} width={extW} height={BAR_HEIGHT - 1} rx={3} />}
      {extW > 0 && isProjected && <rect className="sp-tl-bar__ext sp-tl-bar__ext--projected" x={x1 - 0.5} y={y + 0.5} width={extW} height={BAR_HEIGHT - 1} rx={3} stroke={edge} />}
      {tagText && (
        <g className="sp-tl-tag sp-tl-tag--risk" aria-hidden="true">
          <rect x={tagX} y={y + 3} width={tagW} height={16} rx={3} />
          <text x={tagX + tagW / 2} y={y + 15} textAnchor="middle">
            {tagText}
          </text>
        </g>
      )}
      {nameText && (
        <text className="sp-tl-bar__text" x={textX} y={y + BAR_HEIGHT / 2 + 4} fill={ink}>
          <tspan className="sp-tl-bar__name">{nameText}</tspan>
          {subText && <tspan className="sp-tl-bar__sub"> · {subText}</tspan>}
        </text>
      )}
    </g>
  );
}
