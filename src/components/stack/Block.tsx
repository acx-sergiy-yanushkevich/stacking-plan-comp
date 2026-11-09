import type { KeyboardEvent } from 'react';
import type { Segment } from '../../domain/derive';
import { textTier } from '../../domain/layout';
import { fitWords, wrapWords, fits } from '../../lib/textFit';
import { PATTERN_IDS } from '../plan/Patterns';
import type { SegmentText } from '../plan/segmentText';

export const FONT_NAME = "600 13px Inter, 'Salesforce Sans', system-ui, sans-serif";
export const FONT_SUB = "400 12px Inter, 'Salesforce Sans', system-ui, sans-serif";
export const FONT_BADGE = "600 11px Inter, 'Salesforce Sans', system-ui, sans-serif";

export interface BlockProps {
  seg: Segment;
  text: SegmentText;
  x: number;
  y: number;
  w: number;
  h: number;
  selected: boolean;
  dim: boolean;
  focusable: boolean;
  onSelect: () => void;
  onFocus: () => void;
  onKeyDown: (e: KeyboardEvent<SVGGElement>) => void;
  /** Enlarged to the minimum width: widths on this floor are not strictly proportional. */
  enlarged: boolean;
  compact?: boolean;
}

const PAD = 8;
const LINE = 15;

/** One suite on the plan: tone fill, pattern, accent bar, adaptive text, badges. */
export function Block({ seg, text, x, y, w, h, selected, dim, focusable, onSelect, onFocus, onKeyDown, enlarged, compact }: BlockProps) {
  const tone = text.tone;
  const fill = `var(--tone-${tone}-fill)`;
  const edge = `var(--tone-${tone}-edge)`;
  const color = `var(--tone-${tone}-text)`;
  const tier = textTier(w);
  const maxLines = Math.max(1, Math.floor((h - PAD * 2 + 3) / LINE));

  // Badges: deal count pill always (if room); first text badge when wide enough.
  const deal = text.badges.find((b) => b.kind === 'deal');
  const other = text.badges.find((b) => b.kind !== 'deal');
  const showDeal = !!deal && w >= 64 && !compact;
  const showOther = !!other && w >= 150 && h >= 56;
  const badgeW = other ? Math.ceil(other.text.length * 6.2) + 12 : 0;
  // Text on the first line must clear the badges in the top-right corner.
  const reserved = (showOther ? badgeW + 6 : 0) + (showDeal ? 22 : 0);
  const inner = w - PAD * 2 - reserved;

  // Decide the lines (never truncate a word; drop lines instead).
  const lines: Array<{ t: string; cls: string; font: string }> = [];
  if (tier <= 1) {
    const nameLines = wrapWords(text.name, inner, FONT_NAME, 2);
    for (const l of nameLines) lines.push({ t: l, cls: 'sp-seg__name', font: FONT_NAME });
    const sub = tier === 0 ? text.sub : `${text.sfShort} SF`;
    if (lines.length < maxLines) lines.push({ t: fits(sub, inner, FONT_SUB) ? sub : `${text.sfShort} SF`, cls: 'sp-seg__sub', font: FONT_SUB });
    if (lines.length < maxLines && text.meta && fits(text.meta, inner, FONT_SUB)) lines.push({ t: text.meta, cls: 'sp-seg__meta', font: FONT_SUB });
    else if (lines.length < maxLines && text.meta) {
      const short = fitWords(text.meta, inner, FONT_SUB);
      if (short && short.length >= 6) lines.push({ t: short, cls: 'sp-seg__meta', font: FONT_SUB });
    }
  } else if (tier === 2) {
    // Narrow: the whole name or nothing (a partial name misleads more than it helps).
    if (fits(text.name, inner, FONT_NAME)) lines.push({ t: text.name, cls: 'sp-seg__name', font: FONT_NAME });
    else if (!compact) {
      const two = wrapWords(text.name, inner, FONT_NAME, 2);
      if (two.length === 2 && two.join(' ') === text.name && maxLines >= 3) for (const l of two) lines.push({ t: l, cls: 'sp-seg__name', font: FONT_NAME });
    }
    const withUnit = `${text.sfShort} SF`;
    const sfText = fits(withUnit, inner, FONT_SUB) ? withUnit : text.sfShort;
    if (fits(sfText, inner, FONT_SUB)) lines.push({ t: sfText, cls: 'sp-seg__sf', font: FONT_SUB });
  }
  if (lines.length > maxLines) lines.length = maxLines;

  const pattern = text.pattern;
  const patternFill = pattern === 'hatch' ? `url(#${PATTERN_IDS.hatch})` : pattern === 'dots' ? `url(#${PATTERN_IDS.dots})` : pattern === 'asking' ? `url(#${PATTERN_IDS.asking})` : null;
  const accentLeft = tone === 'expiring' || tone === 'risk';
  const accentTop = tone === 'rent-net';

  return (
    <g
      className={`sp-seg ${selected ? 'is-selected' : ''} ${dim ? 'is-dim' : ''} ${pattern === 'dashed' ? 'sp-seg--dashed' : ''}`}
      role="gridcell"
      tabIndex={focusable ? 0 : -1}
      aria-label={text.aria}
      aria-selected={selected}
      data-key={seg.key}
      transform={`translate(${x} ${y})`}
      onClick={onSelect}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      style={{ color: edge }}
    >
      <title>{text.tooltip + (enlarged ? '\nDrawn at minimum width for legibility' : '')}</title>
      <rect className="sp-seg__ring" x={-3} y={-3} width={w + 6} height={h + 6} rx={7} />
      <rect className="sp-seg__rect" width={w} height={h} rx={4} fill={fill} stroke={edge} />
      {patternFill && <rect width={w} height={h} rx={4} fill={patternFill} pointerEvents="none" />}
      {accentLeft && <rect className="sp-seg__accent" x={0} y={0} width={3} height={h} rx={1} fill={edge} />}
      {accentTop && <rect className="sp-seg__accent" x={0} y={0} width={w} height={3} fill={edge} />}
      {lines.map((l, i) => (
        <text key={i} className={l.cls} x={PAD + (accentLeft ? 3 : 0)} y={PAD + 11 + i * LINE} fill={color}>
          {l.t}
        </text>
      ))}
      {showOther && other && (
        <g className={`sp-badge sp-badge--${other.kind}`} transform={`translate(${w - badgeW - 6 - (showDeal ? 22 : 0)} 6)`}>
          <title>{other.title ?? other.text}</title>
          <rect width={badgeW} height={16} rx={8} />
          <text x={badgeW / 2} y={11.5} textAnchor="middle">
            {other.text}
          </text>
        </g>
      )}
      {showDeal && deal && (
        <g className="sp-badge sp-badge--deal" transform={`translate(${w - 22} 6)`}>
          <title>{deal.title}</title>
          <rect width={16} height={16} rx={8} />
          <text x={8} y={11.5} textAnchor="middle">
            {deal.text}
          </text>
        </g>
      )}
    </g>
  );
}
