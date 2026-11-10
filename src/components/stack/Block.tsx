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
export const FONT_MICRO = "600 10px Inter, 'Salesforce Sans', system-ui, sans-serif";

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
  /** A near miss of the active finder: kept readable, not dimmed. */
  partial?: boolean;
}

const PAD = 8;
const LINE = 15;
/** Compact line pitch, used only when it lets a whole name keep its SF line. */
const CP = 12.5;
/** One-letter state cue for blocks too narrow for any text. */
const GLYPH: Partial<Record<Segment['kind'], string>> = { available: 'A', sublease: 'S', committed: 'C', forsale: '$', holdover: '!', mtm: '!', unmarketed: '?', projected: 'V' };
/** The state in a word, for blocks too narrow for their name; same vocabulary as the legend. */
const STATE_WORD: Partial<Record<Segment['kind'], string[]>> = { available: ['Available'], sublease: ['Sublease'], committed: ['Signed'], forsale: ['For sale'], unmarketed: ['Unaccounted'], projected: ['Vacant'] };

/** One suite on the plan: tone fill, pattern, accent bar, adaptive text, badges. */
export function Block({ seg, text, x, y, w, h, selected, dim, focusable, onSelect, onFocus, onKeyDown, enlarged, compact, related, partial }: BlockProps) {
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
  const innerBody = w - PAD * 2;

  // Decide the lines. Rules, in priority order:
  //  1. a name is shown whole (13 px on one or two lines, or 11 px on up to three) or not at all;
  //  2. the SF figure is never dropped in favour of a name;
  //  3. the lens fact (date, rate, stage) is kept whenever name and SF leave a line for it, stepping
  //     down to 11 px and 10 px on narrow blocks before a rate is split over two lines;
  //  4. a block with no room for its name says its state in a word, so colour is never the only cue.
  type Line = { t: string; cls: string; font: string };
  const accentLeft = tone === 'expiring' || tone === 'risk';
  const accentPad = accentLeft ? 3 : 0;
  /** Does line i run beside the bottom-right deal pill at this line pitch? */
  const pillHit = (i: number, compact: boolean) => showDeal && pillBottom && (compact ? 17 + CP * i : PAD + 11 + LINE * i) + 3 > h - 22;
  const sfUnit = `${text.sfShort} SF`;
  const sfLens = text.lensShort ? `${sfUnit} · ${text.lensShort}` : null;
  const isSmall = (l: Line) => l.cls === 'sp-seg__tiny' || l.cls === 'sp-seg__micro';
  /** Usable width of line i: the first line clears the corner badges; small type runs closer to the edges. */
  const room = (i: number, font: string, compact: boolean) => {
    const pill = pillHit(i, compact) ? 22 : 0;
    const base = (i === 0 ? inner : innerBody) - pill;
    if (i === 0 && reserved) return base;
    if (font === FONT_TINY) return Math.max(base, w - 8 - accentPad - pill);
    if (font === FONT_MICRO) return w - 4 - accentPad - pill;
    return base;
  };
  /** A fact on line i at the largest size that fits (12 px; 11 and 10 px on narrow blocks only). */
  const sized = (t: string, i: number, cls: string, compact: boolean): Line | null => {
    if (fits(t, room(i, FONT_SUB, compact), FONT_SUB)) return { t, cls, font: FONT_SUB };
    if (tier === 0 || !compact) return null;
    if (fits(t, room(i, FONT_TINY, true), FONT_TINY)) return { t, cls: 'sp-seg__tiny', font: FONT_TINY };
    if (fits(t, room(i, FONT_MICRO, true), FONT_MICRO)) return { t, cls: 'sp-seg__micro', font: FONT_MICRO };
    return null;
  };
  /** Fact lines that can follow n name lines: with the lens fact, with a rate split over two lines, SF only. */
  /** Placeholder for a variant that does not fit at this pitch (keeps variants index-aligned across pitches). */
  const NONE: Line[] = [];
  const factSets = (n: number, compact: boolean) => {
    const full: Line[][] = [];
    const split: Line[][] = [];
    const sfOnly: Line[][] = [];
    if (tier === 0) {
      const first: Line = { t: fits(text.sub, room(n, FONT_SUB, compact), FONT_SUB) ? text.sub : sfUnit, cls: 'sp-seg__sub', font: FONT_SUB };
      if (text.meta) {
        // A rate is shown whole or not at all (dropping the lease type would mislead); other facts may lose trailing parts.
        const isRate = text.meta.includes('$');
        const r = room(n + 1, FONT_SUB, compact);
        const alt = fits(text.meta, r, FONT_SUB) ? text.meta : isRate ? text.meta.replace(/^Asking /, '') : fitParts(text.meta, r, FONT_SUB);
        full.push(alt && fits(alt, r, FONT_SUB) && (isRate || alt.length >= 4) ? [first, { t: alt, cls: 'sp-seg__meta', font: FONT_SUB }] : NONE);
      } else full.push(NONE);
      // Short rows: SF and the lens fact share one line rather than repeat a date on two.
      full.push(sfLens && fits(sfLens, room(n, FONT_SUB, compact), FONT_SUB) ? [{ t: sfLens, cls: 'sp-seg__sub', font: FONT_SUB }] : NONE);
      sfOnly.push([first]);
    } else {
      const sfL = sized(sfUnit, n, 'sp-seg__sf', compact);
      if (text.lensShort) {
        full.push(sfLens && fits(sfLens, room(n, FONT_SUB, compact), FONT_SUB) ? [{ t: sfLens, cls: 'sp-seg__sf', font: FONT_SUB }] : NONE);
        if (sfL) {
          const l = sized(text.lensShort, n + 1, 'sp-seg__meta', compact);
          // When the fact only fits on the line above the deal pill, SF takes the line beside the pill.
          const up = l ? null : sized(text.lensShort, n, 'sp-seg__meta', compact);
          const sfDown = up ? sized(sfUnit, n + 1, 'sp-seg__sf', compact) : null;
          full.push(l ? [sfL, l] : up && sfDown ? [up, sfDown] : NONE);
          if (!l && !(up && sfDown) && text.lensShort.includes('$') && text.lensShort.includes(' ')) {
            // Last resort for a rate: unit and lease type on a second line ("$32/SF/yr" / "FSG").
            const cut = text.lensShort.lastIndexOf(' ');
            const r1 = sized(text.lensShort.slice(0, cut), n + 1, 'sp-seg__meta', compact);
            const r2 = sized(text.lensShort.slice(cut + 1), n + 2, 'sp-seg__meta', compact);
            if (r1 && r2) split.push([sfL, r1, r2]);
          }
        }
      }
      if (sfL) sfOnly.push([sfL]);
    }
    return { full, split, sfOnly };
  };
  const fit = (ls: Line[], named: boolean) => {
    const small = ls.some(isSmall);
    const cap = small || ls.length > cap15 ? cap13 : cap15;
    return ls.length > 0 && ls.length <= cap ? { lines: ls, compact: small || ls.length > cap15, named } : null;
  };
  const nameLine = (t: string): Line => ({ t, cls: 'sp-seg__name', font: FONT_NAME });
  const nameSets: Line[][] = [];
  if (fits(text.name, inner, FONT_NAME)) nameSets.push([nameLine(text.name)]);
  else {
    const two = wrapWords(text.name, inner, FONT_NAME, 2);
    if (two.length && two.join(' ') === text.name) nameSets.push(two.map(nameLine));
    const tiny = h >= 48 ? wrapWords(text.name, room(0, FONT_TINY, true), FONT_TINY, 3) : [];
    if (tiny.length && tiny.join(' ') === text.name) nameSets.push(tiny.map((t) => ({ t, cls: 'sp-seg__tiny', font: FONT_TINY })));
    // Narrow tiles: the whole name at 10 px before giving it up.
    const micro = tier >= 2 && h >= 48 && seg.kind !== 'unmarketed' ? wrapWords(text.name, room(0, FONT_MICRO, true), FONT_MICRO, 2) : [];
    if (micro.length && micro.join(' ') === text.name && !(tiny.length && tiny.join(' ') === text.name)) nameSets.push(micro.map((t) => ({ t, cls: 'sp-seg__micro', font: FONT_MICRO })));
  }
  /** The state in a word, for a block that cannot hold its name. */
  const wordLine = (): Line[] => {
    const words = seg.kind === 'unmarketed' && /not available/.test(text.name) ? ['Not available'] : seg.kind === 'available' && seg.availability?.isVacant && !seg.availableFrom ? ['Available', 'Vacant'] : (STATE_WORD[seg.kind] ?? []);
    for (const t of words) {
      if (fits(t, inner, FONT_NAME)) return [nameLine(t)];
      if (fits(t, room(0, FONT_TINY, true), FONT_TINY)) return [{ t, cls: 'sp-seg__tiny', font: FONT_TINY }];
      if (fits(t, room(0, FONT_MICRO, true), FONT_MICRO)) return [{ t, cls: 'sp-seg__micro', font: FONT_MICRO }];
    }
    return [];
  };
  /** First layout in a category that fits; widths are computed for the pitch the layout ends up using. */
  const tryCat = (cat: 'full' | 'split' | 'sfOnly', leads: Line[][], named: boolean, maxLines = 99) => {
    for (const lead of leads) {
      // Richer variants first (suite and months before the one-line form), at the regular pitch before the compact one.
      const sets = [false, true].map((compact) => factSets(lead.length, compact)[cat]);
      for (let i = 0; i < Math.max(sets[0].length, sets[1].length); i += 1)
        for (const compact of [false, true]) {
          const fs = sets[compact ? 1 : 0][i];
          if (!fs || fs.length === 0 || lead.length + fs.length > maxLines) continue;
          // A wrapped 13 px name needs the regular pitch; at the tight pitch the 11 px name is used instead.
          if (compact && lead.length > 1 && lead[0].font === FONT_NAME) continue;
          const r = fit([...lead, ...fs], named);
          if (r && r.compact === compact) return r;
        }
    }
    return null;
  };
  const pick = () => {
    const withName = tryCat('full', nameSets, true) ?? tryCat('split', nameSets, true, 4) ?? tryCat('sfOnly', nameSets, true);
    if (withName) return withName;
    // No name fits together with its SF line: the state word (when there is one), SF and the lens fact.
    const wl = wordLine();
    for (const lead of wl.length ? [wl, []] : [[]]) {
      const r = tryCat('full', [lead], false) ?? tryCat('split', [lead], false) ?? tryCat('sfOnly', [lead], false);
      if (r) return r;
    }
    return wl.length ? fit(wl, false) : null;
  };
  const picked = pick();
  const lines: Line[] = picked?.lines ?? [];
  const compactPitch = picked?.compact ?? false;
  const lineX = (l: Line) => (l.cls === 'sp-seg__micro' ? 2 : l.cls === 'sp-seg__tiny' ? 4 : PAD) + accentPad;
  // Narrowest tier: a single state glyph so colour is never the only cue.
  const glyph = lines.length === 0 && w >= 24 && h >= 40 ? (GLYPH[seg.kind] ?? null) : null;

  const pattern = text.pattern;
  const patternFill = pattern === 'hatch' ? `url(#${PATTERN_IDS.hatch})` : pattern === 'dots' ? `url(#${PATTERN_IDS.dots})` : pattern === 'asking' ? `url(#${PATTERN_IDS.asking})` : null;
  // Accessible name: floor, the full name when it is not drawn, exactly what is drawn (WCAG 2.5.3), then
  // the facts that are not drawn. Nothing is said twice.
  const drawn = [...lines.map((l) => l.t), showSecond && second ? second.text : '', showOther && other ? other.text : ''].filter(Boolean);
  const visible = [...drawn, showDeal && deal ? deal.text : ''].filter(Boolean).join(' ');
  const dealTail = showDeal && deal ? ` live deal${deal.text === '1' ? '' : 's'}` : '';
  const floorName = text.aria.split(',')[0];
  const extras = [text.sub, text.meta, ...text.badges.filter((bd) => !(bd.kind === 'deal' && dealTail) && !visible.includes(bd.text)).map((bd) => (bd.kind === 'deal' ? `${bd.text} live deal${bd.text === '1' ? '' : 's'}` : bd.title ?? bd.text))].filter((t, i, all) => t && !visible.includes(t) && all.indexOf(t) === i);
  // The drawn label is kept contiguous (WCAG 2.5.3) but read with pauses: the lines are joined by line breaks.
  const spoken = [...drawn, showDeal && deal ? `${deal.text}${dealTail}` : ''].filter(Boolean).join('\n');
  const ariaLabel = `${[floorName, picked?.named ? null : text.name, spoken || null].filter(Boolean).join(', ')}${extras.length ? `. ${extras.join(', ')}` : ''}`;
  const accentTop = tone === 'rent-net';

  return (
    <g
      className={`sp-seg ${selected ? 'is-selected' : ''} ${related ? 'is-related' : ''} ${dim ? 'is-dim' : ''} ${partial ? 'is-partial' : ''} ${pattern === 'dashed' ? 'sp-seg--dashed' : ''}`}
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
      {w > 16 && <rect className="sp-seg__gloss" x={5} y={1.2} width={w - 10} height={1} rx={0.5} />}
      {patternFill && <rect width={w} height={h} rx={4} fill={patternFill} pointerEvents="none" />}
      {patternFill && lines.length > 0 &&
        (tone === 'empty' || tone === 'deal-none' ? [{ f: 'var(--sp-color-card)', o: 0.9 }] : [{ f: fill, o: 0.9 }]).map((layer, i) => (
          <rect
            key={i}
            className="sp-seg__backing"
            x={Math.max(1, Math.min(...lines.map(lineX)) - 4)}
            y={(compactPitch ? 6 : PAD) - 3}
            width={Math.min(w - 2, Math.ceil(Math.max(...lines.map((l) => measure(l.t, l.font)))) + 8)}
            height={lines.length * (compactPitch ? CP : LINE) + 4}
            rx={3}
            fill={layer.f}
            fillOpacity={layer.o}
            pointerEvents="none"
          />
        ))}
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
        <text key={i} className={l.cls} x={lineX(l)} y={top + i * pitch} fill={color}>
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
