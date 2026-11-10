import type { KeyboardEvent } from 'react';
import type { Segment } from '../../domain/derive';
import { textTier } from '../../domain/layout';
import { fitParts, wrapWords, fits, measure } from '../../lib/textFit';
import { PATTERN_IDS } from '../plan/Patterns';
import type { SegmentText } from '../plan/segmentText';

export const FONT_NAME = "600 13px Inter, 'Salesforce Sans', system-ui, sans-serif";
export const FONT_SUB = "400 12px Inter, 'Salesforce Sans', system-ui, sans-serif";
export const FONT_BADGE = "600 11px Inter, 'Salesforce Sans', system-ui, sans-serif";
export const FONT_TINY = "600 11px Inter, 'Salesforce Sans', system-ui, sans-serif";

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
  /** Another unit of the selected lease (multi-floor tenant). */
  related?: boolean;
}

const PAD = 8;
const LINE = 15;
/** Up to three initials of a name ("Preston Park Café" → "PPC"). */
const initials = (name: string) => name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 3).map((w) => w[0].toUpperCase()).join('') || null;
/** One-letter state cue for blocks too narrow for any text. */
const GLYPH: Partial<Record<Segment['kind'], string>> = { available: 'A', sublease: 'S', committed: 'C', forsale: '$', holdover: '!', mtm: '!', unmarketed: '?', projected: 'V' };
const GLYPH_WORD: Partial<Record<Segment['kind'], string>> = { available: 'Avail', sublease: 'Sublet', committed: 'Signed', forsale: 'Sale', unmarketed: 'Gap', projected: 'Vacant' };

/** One suite on the plan: tone fill, pattern, accent bar, adaptive text, badges. */
export function Block({ seg, text, x, y, w, h, selected, dim, focusable, onSelect, onFocus, onKeyDown, enlarged, compact, related }: BlockProps) {
  const tone = text.tone;
  const fill = `var(--tone-${tone}-fill)`;
  const edge = `var(--tone-${tone}-edge)`;
  const color = `var(--tone-${tone}-text)`;
  const tier = textTier(w);
  const maxLines = Math.max(1, Math.floor((h - PAD * 2 + 3) / LINE));

  // Badges: deal count pill always (if room); first text badge when wide enough.
  const deal = text.badges.find((b) => b.kind === 'deal');
  const others = text.badges.filter((b) => b.kind !== 'deal');
  const other = others[0];
  const second = others[1];
  const showDeal = !!deal && w >= 64 && !compact;
  const showOther = !!other && w >= 150 && h >= 40;
  const showSecond = !!second && w >= 300 && h >= 40;
  const badgeW = other ? Math.ceil(other.text.length * 6.2) + 12 : 0;
  const badge2W = second ? Math.ceil(second.text.length * 6.2) + 12 : 0;
  // Text on the first line must clear the badges in the top-right corner. On narrow blocks the deal
  // pill moves to the bottom-right so the tenant name keeps the full width.
  const pillBottom = tier >= 2;
  const reserved = (showOther ? badgeW + 6 : 0) + (showSecond ? badge2W + 6 : 0) + (showDeal && !pillBottom ? 22 : 0);
  const inner = w - PAD * 2 - reserved;

  // Decide the lines (never truncate a word; drop lines instead).
  const lines: Array<{ t: string; cls: string; font: string }> = [];
  if (tier <= 1) {
    const nameLines = wrapWords(text.name, inner, FONT_NAME, 2);
    for (const l of nameLines) lines.push({ t: l, cls: 'sp-seg__name', font: FONT_NAME });
    const sub = tier === 0 ? text.sub : `${text.sfShort} SF`;
    // When the name took two lines there is room for one more: keep the lens value, not the suite number.
    const nameTookTwo = nameLines.length === 2;
    const squeezed = text.lensShort ? `${text.sfShort} SF · ${text.lensShort}` : null;
    if (lines.length < maxLines) {
      const t = nameTookTwo && squeezed && fits(squeezed, inner, FONT_SUB) ? squeezed : fits(sub, inner, FONT_SUB) ? sub : `${text.sfShort} SF`;
      if (fits(t, inner, FONT_SUB) || t === `${text.sfShort} SF`) lines.push({ t, cls: 'sp-seg__sub', font: FONT_SUB });
    }
    if (lines.length < maxLines && text.meta && fits(text.meta, inner, FONT_SUB)) lines.push({ t: text.meta, cls: 'sp-seg__meta', font: FONT_SUB });
    else if (lines.length < maxLines && text.meta) {
      // A rate is shown whole or not at all (dropping the lease type would mislead); other facts may lose trailing parts.
      const isRate = text.meta.includes('$');
      const alt = isRate ? text.meta.replace(/^Asking /, '') : fitParts(text.meta, inner, FONT_SUB);
      if (alt && (isRate ? fits(alt, inner, FONT_SUB) : alt.length >= 4)) lines.push({ t: alt, cls: 'sp-seg__meta', font: FONT_SUB });
    }
  } else if (tier === 2) {
    // Narrow: the whole name (on one or two lines) or nothing; a partial name misleads more than it helps.
    if (fits(text.name, inner, FONT_NAME)) lines.push({ t: text.name, cls: 'sp-seg__name', font: FONT_NAME });
    else if (maxLines >= 2) {
      const two = wrapWords(text.name, inner, FONT_NAME, 2);
      if (two.length === 2 && two.join(' ') === text.name) for (const l of two) lines.push({ t: l, cls: 'sp-seg__name', font: FONT_NAME });
    }
    const withUnit = `${text.sfShort} SF`;
    const withLens = text.lensShort ? `${text.sfShort} SF · ${text.lensShort}` : null;
    const sfText = withLens && fits(withLens, inner, FONT_SUB) ? withLens : fits(withUnit, inner, FONT_SUB) ? withUnit : null;
    if (sfText) lines.push({ t: sfText, cls: 'sp-seg__sf', font: FONT_SUB });
    else if (lines.length === 0 && fits(withUnit, inner + PAD, FONT_SUB)) lines.push({ t: withUnit, cls: 'sp-seg__sf', font: FONT_SUB });
    if (text.lensShort && lines.length < maxLines && !lines.some((l) => l.t.includes(text.lensShort)) && fits(text.lensShort, inner, FONT_SUB)) lines.push({ t: text.lensShort, cls: 'sp-seg__meta', font: FONT_SUB });
    // A wrapped name plus SF plus the lens fact needs four lines: use the compact 13 px pitch when the row allows it.
    if (text.lensShort && !lines.some((l) => l.t.includes(text.lensShort)) && lines.length === maxLines && h >= 4 * 13 + 14 && fits(text.lensShort, inner, FONT_TINY)) {
      lines.push({ t: text.lensShort, cls: 'sp-seg__tiny-meta', font: FONT_TINY });
    }
  }
  // Too many lines: drop the second name line before any SF / lens line (the tooltip keeps the full name).
  while (lines.length > maxLines) {
    const nameIdx = lines.map((l) => l.cls).lastIndexOf('sp-seg__name');
    if (nameIdx > 0 && lines.filter((l) => l.cls === 'sp-seg__name').length > 1) lines.splice(nameIdx, 1);
    else lines.length = maxLines;
  }
  // SF alone says nothing about state: prefix the state word when the only line is the SF figure.
  if (lines.length === 1 && lines[0].cls === 'sp-seg__sf') {
    const word = GLYPH_WORD[seg.kind] ?? (seg.kind === 'leased' || seg.kind === 'holdover' || seg.kind === 'mtm' ? '' : '');
    const withWord = word ? `${word} ${lines[0].t}` : '';
    if (withWord && fits(withWord, inner, FONT_SUB)) lines[0] = { ...lines[0], t: withWord };
    else if (word && lines.length < maxLines) lines.unshift({ t: word, cls: 'sp-seg__name', font: FONT_NAME });
  }
  // Very narrow blocks: the whole name in up to three short lines before any glyph.
  if (lines.length === 0 && w >= 40 && h >= 48) {
    const small = wrapWords(text.name, w - 8, FONT_TINY, 3);
    if (small.length && small.join(' ') === text.name) for (const l of small) lines.push({ t: l, cls: 'sp-seg__tiny', font: FONT_TINY });
  }
  // Narrowest tier: a single state glyph so colour is never the only cue.
  const glyph = lines.length === 0 && w >= 24 && h >= 40 ? ((w >= 48 && GLYPH_WORD[seg.kind] && fits(GLYPH_WORD[seg.kind]!, w - 8, FONT_SUB) ? GLYPH_WORD[seg.kind] : GLYPH[seg.kind]) ?? initials(text.name)) : null;

  const pattern = text.pattern;
  const patternFill = pattern === 'hatch' ? `url(#${PATTERN_IDS.hatch})` : pattern === 'dots' ? `url(#${PATTERN_IDS.dots})` : pattern === 'asking' ? `url(#${PATTERN_IDS.asking})` : null;
  // WCAG 2.5.3: the accessible name starts with exactly what is visible, then adds context.
  const visible = [glyph ?? '', ...lines.map((l) => l.t), showSecond && second ? second.text : '', showOther && other ? other.text : '', showDeal && deal ? deal.text : ''].filter(Boolean).join(' ');
  // Accessible name: what is visible first, then only the facts that are not already visible.
  const floorName = text.aria.split(',')[0];
  const extras = [text.name, text.sub, text.meta, ...text.badges.map((b) => (b.kind === 'deal' ? `${b.text} live deal${b.text === '1' ? '' : 's'}` : b.title ?? b.text))].filter((t) => t && !visible.includes(t));
  const ariaLabel = `${floorName}${visible ? `, ${visible}` : ''}${extras.length ? `. ${extras.join(', ')}` : ''}`;
  const accentLeft = tone === 'expiring' || tone === 'risk';
  const accentTop = tone === 'rent-net';

  return (
    <g
      className={`sp-seg ${selected ? 'is-selected' : ''} ${related ? 'is-related' : ''} ${dim ? 'is-dim' : ''} ${pattern === 'dashed' ? 'sp-seg--dashed' : ''}`}
      role="gridcell"
      tabIndex={focusable ? 0 : -1}
      aria-label={ariaLabel}
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
      {patternFill && lines.length > 0 && (
        <rect
          className="sp-seg__backing"
          x={PAD - 4 + (accentLeft ? 3 : 0)}
          y={PAD - 3}
          width={Math.min(w - PAD * 2 + 8, Math.ceil(Math.max(...lines.map((l) => measure(l.t, l.font)))) + 8)}
          height={lines.length * LINE + 4}
          rx={3}
          fill={fill}
          fillOpacity={0.9}
          pointerEvents="none"
        />
      )}
      {accentLeft && <rect className="sp-seg__accent" x={0} y={0} width={3} height={h} rx={1} fill={edge} />}
      {accentTop && <rect className="sp-seg__accent" x={0} y={0} width={w} height={3} fill={edge} />}
      {glyph && (
        <text className="sp-seg__glyph" x={w / 2} y={h / 2 + 4} textAnchor="middle" fill={color}>
          {`${glyph} `}
        </text>
      )}
      {lines.map((l, i) => {
        const compactPitch = lines.some((x) => x.cls === 'sp-seg__tiny-meta');
        const pitch = l.cls === 'sp-seg__tiny' ? 13 : compactPitch ? 13 : LINE;
        const top = l.cls === 'sp-seg__tiny' ? 16 : compactPitch ? 7 + 11 : PAD + 11;
        return (
        <text key={i} className={l.cls} x={l.cls === 'sp-seg__tiny' ? 4 : PAD + (accentLeft ? 3 : 0)} y={top + i * pitch} fill={color}>
          {`${l.t} `}
        </text>
        );
      })}
      {showSecond && second && (
        <g className={`sp-badge sp-badge--${second.kind}`} transform={`translate(${w - badgeW - 6 - (showDeal && !pillBottom ? 22 : 0) - badge2W - 6} 6)`}>
          <title>{second.title ?? second.text}</title>
          <rect width={badge2W} height={16} rx={8} />
          <text x={badge2W / 2} y={11.5} textAnchor="middle">
            {`${second.text} `}
          </text>
        </g>
      )}
      {showOther && other && (
        <g className={`sp-badge sp-badge--${other.kind}`} transform={`translate(${w - badgeW - 6 - (showDeal && !pillBottom ? 22 : 0)} 6)`}>
          <title>{other.title ?? other.text}</title>
          <rect width={badgeW} height={16} rx={8} />
          <text x={badgeW / 2} y={11.5} textAnchor="middle">
            {`${other.text} `}
          </text>
        </g>
      )}
      {showDeal && deal && (
        <g className="sp-badge sp-badge--deal" transform={`translate(${w - 22} ${pillBottom ? h - 22 : 6})`}>
          <title>{deal.title}</title>
          <rect width={16} height={16} rx={8} />
          <text x={8} y={11.5} textAnchor="middle">
            {`${deal.text} `}
          </text>
        </g>
      )}
    </g>
  );
}
