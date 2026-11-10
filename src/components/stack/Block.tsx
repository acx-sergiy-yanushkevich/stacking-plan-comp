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
/** Compact line pitch, used only when it lets a whole name keep its SF line. */
const CP = 12.5;
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
  // Line budgets: the regular 15 px pitch, and a compact 13 px pitch used only when it lets a whole
  // name keep its SF line (a wrapped name + SF + lens fact needs four lines in a 66 px row).
  const cap15 = Math.max(1, Math.floor((h - PAD * 2 + 3) / LINE));
  const cap13 = h >= 3 * CP + 10 ? Math.max(cap15, Math.floor((h - 12 + 3) / CP)) : cap15;

  // Badges: deal count pill always (if room); first text badge when wide enough.
  const deal = text.badges.find((b) => b.kind === 'deal');
  const others = text.badges.filter((b) => b.kind !== 'deal');
  const other = others[0];
  const second = others[1];
  const showDeal = !!deal && w >= 64 && !compact;
  const showOther = !!other && w >= 150 && h >= 40;
  const showSecond = !!second && w >= 300 && h >= 40;
  const badgeW = other ? Math.ceil(measure(other.text, FONT_BADGE)) + 12 : 0;
  const badge2W = second ? Math.ceil(measure(second.text, FONT_BADGE)) + 12 : 0;
  // Text on the first line must clear the badges in the top-right corner. On narrow blocks the deal
  // pill moves to the bottom-right so the tenant name keeps the full width.
  const pillBottom = tier >= 2;
  const reserved = (showOther ? badgeW + 6 : 0) + (showSecond ? badge2W + 6 : 0) + (showDeal && !pillBottom ? 22 : 0);
  const inner = w - PAD * 2 - reserved;
  // Lines below the first run the full width (the corner badges only occupy the first line); the
  // bottom-right deal pill reserves its corner on the last line instead.
  const innerBody = w - PAD * 2 - (showDeal && pillBottom ? 22 : 0);

  // Decide the lines. Rules: a name is shown whole or not at all (a fragment misleads; the tooltip and
  // the accessible name carry the full name); the SF line is never dropped in favour of a name line;
  // facts beyond SF (suite, lens value, meta) fill whatever room is left.
  type Line = { t: string; cls: string; font: string };
  const sfUnit = `${text.sfShort} SF`;
  const sfLens = text.lensShort ? `${sfUnit} · ${text.lensShort}` : null;
  const factsFor = (nameLineCount: number): Line[] => {
    const out: Line[] = [];
    // Width available to the fact at index i: the first line of the block clears the corner badges.
    const fw = (i: number) => (nameLineCount + i === 0 ? inner : innerBody);
    if (tier === 0) {
      // Full tier: suite + SF (or SF + lens value when the name took two lines), then the meta line.
      const squeezed = nameLineCount >= 2 && sfLens && fits(sfLens, fw(0), FONT_SUB) ? sfLens : null;
      const first = squeezed ?? (fits(text.sub, fw(0), FONT_SUB) ? text.sub : sfLens && fits(sfLens, fw(0), FONT_SUB) ? sfLens : sfUnit);
      out.push({ t: first, cls: 'sp-seg__sub', font: FONT_SUB });
      if (text.meta) {
        // A rate is shown whole or not at all (dropping the lease type would mislead); other facts may lose trailing parts.
        const isRate = text.meta.includes('$');
        const alt = fits(text.meta, fw(1), FONT_SUB) ? text.meta : isRate ? text.meta.replace(/^Asking /, '') : fitParts(text.meta, fw(1), FONT_SUB);
        if (alt && fits(alt, fw(1), FONT_SUB) && (isRate || alt.length >= 4) && !first.includes(alt)) out.push({ t: alt, cls: 'sp-seg__meta', font: FONT_SUB });
      }
    } else {
      const sfLine = sfLens && fits(sfLens, fw(0), FONT_SUB) ? sfLens : fits(sfUnit, fw(0), FONT_SUB) ? sfUnit : fits(sfUnit, fw(0) + PAD, FONT_SUB) ? sfUnit : null;
      if (sfLine) out.push({ t: sfLine, cls: 'sp-seg__sf', font: FONT_SUB });
      else if (fits(sfUnit, w - 6, FONT_TINY)) out.push({ t: sfUnit, cls: 'sp-seg__tiny', font: FONT_TINY });
      if (text.lensShort && !(sfLine && sfLine.includes(text.lensShort))) {
        if (fits(text.lensShort, fw(out.length), FONT_SUB)) out.push({ t: text.lensShort, cls: 'sp-seg__meta', font: FONT_SUB });
        else if (text.lensShort.includes('$') && text.lensShort.includes(' ')) {
          // A rate that is too long for one line keeps its unit and type on a second line ("$32/SF/yr" / "FSG").
          const cut = text.lensShort.lastIndexOf(' ');
          const a = text.lensShort.slice(0, cut);
          const b = text.lensShort.slice(cut + 1);
          if (fits(a, fw(out.length), FONT_SUB) && fits(b, fw(out.length + 1), FONT_SUB)) out.push({ t: a, cls: 'sp-seg__meta', font: FONT_SUB }, { t: b, cls: 'sp-seg__meta', font: FONT_SUB });
        }
      }
    }
    return out;
  };
  const attempt = (nameLines: string[], cls: string, font: string): { lines: Line[]; compact: boolean } | null => {
    const facts = factsFor(nameLines.length);
    if (nameLines.length === 0 && facts.length === 0) return null;
    const name: Line[] = nameLines.map((t) => ({ t, cls, font }));
    const fit = (facts2: Line[]) => {
      const need = name.length + facts2.length;
      if (need <= cap15) return { lines: [...name, ...facts2], compact: false };
      if (need <= cap13) return { lines: [...name, ...facts2], compact: true };
      return null;
    };
    // Optional facts (never the SF line) go first when the row is short.
    if (fit(facts)) return fit(facts);
    // Drop optional facts from the end; a split rate (two meta lines) goes as a pair.
    let keep = Math.max(1, cap13 - name.length);
    if (keep < facts.length && facts[keep - 1].cls === 'sp-seg__meta' && facts[keep]?.cls === 'sp-seg__meta' && facts[keep - 1].t.includes('$')) keep -= 1;
    return facts.length > 1 ? fit(facts.slice(0, Math.max(1, keep))) : null;
  };
  const whole = (ls: string[]) => ls.length > 0 && ls.join(' ') === text.name;
  const one = fits(text.name, inner, FONT_NAME) ? [text.name] : [];
  const two = one.length ? [] : wrapWords(text.name, inner, FONT_NAME, 2);
  // Tiny lines may use the full width only when no badge sits in the corner.
  const tiny = one.length ? [] : wrapWords(text.name, reserved ? inner : Math.max(inner, w - 8), FONT_TINY, 3);
  const chosen =
    (one.length ? attempt(one, 'sp-seg__name', FONT_NAME) : null) ??
    (whole(two) ? attempt(two, 'sp-seg__name', FONT_NAME) : null) ??
    (whole(tiny) && h >= 48 ? attempt(tiny, 'sp-seg__tiny', FONT_TINY) : null) ??
    attempt([], 'sp-seg__name', FONT_NAME);
  const lines: Line[] = chosen?.lines ?? [];
  const compactPitch = (chosen?.compact ?? false) || lines.some((l) => l.cls === 'sp-seg__tiny');
  const maxLines = compactPitch ? cap13 : cap15;
  // SF alone says nothing about state: prefix the state word when the only line is the SF figure.
  if (lines.length === 1 && lines[0].cls === 'sp-seg__sf') {
    const word = GLYPH_WORD[seg.kind] ?? '';
    const withWord = word ? `${word} ${lines[0].t}` : '';
    if (withWord && fits(withWord, inner, FONT_SUB)) lines[0] = { ...lines[0], t: withWord };
    else if (word && lines.length < maxLines) lines.unshift({ t: word, cls: 'sp-seg__name', font: FONT_NAME });
  }
  // Narrowest tier: a single state glyph so colour is never the only cue.
  const glyph = lines.length === 0 && w >= 24 && h >= 40 ? ((w >= 48 && GLYPH_WORD[seg.kind] && fits(GLYPH_WORD[seg.kind]!, w - 8, FONT_SUB) ? GLYPH_WORD[seg.kind] : GLYPH[seg.kind]) ?? null) : null;

  const pattern = text.pattern;
  const patternFill = pattern === 'hatch' ? `url(#${PATTERN_IDS.hatch})` : pattern === 'dots' ? `url(#${PATTERN_IDS.dots})` : pattern === 'asking' ? `url(#${PATTERN_IDS.asking})` : null;
  // Accessible name: the full name and facts first; the drawn label last so it is still contained (WCAG 2.5.3).
  const visible = [glyph ?? '', ...lines.map((l) => l.t), showSecond && second ? second.text : '', showOther && other ? other.text : '', showDeal && deal ? deal.text : ''].filter(Boolean).join(' ');
  const badgeFacts = text.badges.map((b) => (b.kind === 'deal' ? `${b.text} live deal${b.text === '1' ? '' : 's'}` : b.title ?? b.text)).filter((t) => t && !text.aria.includes(t));
  const ariaLabel = `${text.aria}${badgeFacts.length ? `, ${badgeFacts.join(', ')}` : ''}${visible && !text.aria.startsWith(visible) ? `. Label: ${visible}` : ''}`;
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
          height={lines.length * (compactPitch ? CP : LINE) + 4}
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
        const pitch = compactPitch ? CP : LINE;
        const top = compactPitch ? 6 + 11 : PAD + 11;
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
