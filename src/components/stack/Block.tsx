import type { KeyboardEvent } from 'react';
import type { Segment } from '../../domain/derive';
import { textTier } from '../../domain/layout';
import { NO_RECORD, NOT_ON_MARKET } from '../../domain/lenses';
import { fitParts, wrapWords, wrapWordsVar, fits, measure } from '../../lib/textFit';
import { PATTERN_IDS } from '../plan/Patterns';
import { badgeLabel, type SegmentText } from '../plan/segmentText';

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
  /** More facts to show when the block is tall enough (a focused floor): rent, term, deal. */
  extra?: string[];
  /** A focused (tall) row: use the roomier text tier so the suite number stays. */
  roomy?: boolean;
  /**
   * Print: a narrow block keeps its suite number ("Ste 100 · 2,400 SF"), at 11 or 10 px if it must. On
   * paper there is no tooltip or inspector to ask, and the rent roll is keyed by suite.
   */
  keepSuite?: boolean;
}

const PAD = 8;
const LINE = 15;
/** Compact line pitch, used only when it lets a whole name keep its SF line. */
const CP = 12.5;
/** One-letter state cue for blocks too narrow for any text. */
const GLYPH: Partial<Record<Segment['kind'], string>> = { available: 'A', sublease: 'S', committed: 'C', forsale: '$', holdover: '!', mtm: '!', unmarketed: '?', projected: 'V' };
/** The state in a word, for blocks too narrow for their name; same vocabulary as the legend. */
const STATE_WORD: Partial<Record<Segment['kind'], string[]>> = { available: ['Available'], sublease: ['Sublease'], committed: ['Signed'], forsale: ['For sale'], unmarketed: [NO_RECORD, 'No record'], projected: ['Vacant'] };

/**
 * A wrapped line as it is drawn. Where the wrap falls at a "·" ("Infinity Info Systems · sublease" on two
 * lines), the separator is left out: the line break separates the two parts, and no line ends or begins
 * with a separator. The whole name, separator included, stays in the tooltip.
 */
export const lineText = (line: string): string => line.replace(/^·\s+/, '').replace(/\s+·$/, '');

/** One suite on the plan: tone fill, pattern, accent bar, adaptive text, badges. */
export function Block({ seg, text, x, y, w, h, selected, dim, focusable, onSelect, onFocus, onKeyDown, enlarged, compact, related, partial, extra, roomy, keepSuite }: BlockProps) {
  const tone = text.tone;
  const fill = `var(--tone-${tone}-fill)`;
  const edge = `var(--tone-${tone}-edge)`;
  const color = `var(--tone-${tone}-text)`;
  const tier = roomy ? (Math.max(0, textTier(w) - 1) as ReturnType<typeof textTier>) : textTier(w);

  // Badges: deal count pill always (if room); first text badge when wide enough.
  const deal = text.badges.find((b) => b.kind === 'deal');
  const others = text.badges.filter((b) => b.kind !== 'deal');
  const other = others[0];
  const second = others[1];
  const showDeal = !!deal && w >= 64 && !compact;
  // A wide block says what its count counts ("2 live deals", the phone row's words): a bare "2" in a circle
  // was only explained by its tooltip. Narrower blocks, and paper (whose layouts are fitted around the
  // circle), keep the circle; the words are still in the accessible name.
  const dealWords = showDeal && w >= 280 && !keepSuite ? badgeLabel(deal) : null;
  const dealW = dealWords ? Math.ceil(measure(dealWords, FONT_BADGE)) + 12 : 16;
  /** The room the deal pill takes in the top-right corner, with its gap. */
  const dealRoom = dealW + 6;
  const showOther = !!other && w >= 150 && h >= 40;
  const showSecond = !!second && w >= 300 && h >= 40;
  const badgeW = other ? Math.ceil(measure(other.text, FONT_BADGE)) + 12 : 0;
  const badge2W = second ? Math.ceil(measure(second.text, FONT_BADGE)) + 12 : 0;
  // On narrow blocks the deal pill moves to the bottom-right so the tenant name keeps the full width.
  const pillBottom = tier >= 2;
  // A badge wider than half a narrow block would force the name to wrap ("Available / now" beside
  // "1 inquiry fits"): it can take a row of its own under the text instead.
  const rowBadge = showOther && !showSecond && w < 200 && h >= 64 && badgeW + 6 > (w - PAD * 2) / 2;

  type Line = { t: string; cls: string; font: string };
  const accentLeft = tone === 'expiring' || tone === 'risk';
  const accentPad = accentLeft ? 3 : 0;
  const sfUnit = `${text.sfShort} SF`;
  const isSmall = (l: Line) => l.cls === 'sp-seg__tiny' || l.cls === 'sp-seg__micro';
  const nameLine = (t: string): Line => ({ t, cls: 'sp-seg__name', font: FONT_NAME });
  /** Placeholder for a variant that does not fit at this pitch (keeps variants index-aligned across pitches). */
  const NONE: Line[] = [];

  // Decide the lines. Rules, in priority order:
  //  1. a name is shown whole or not at all, at 13 px on one or two lines;
  //  2. the SF figure is never dropped in favour of a name;
  //  3. the lens fact (date, rate, stage) is kept whenever name and SF leave a line for it, and a block
  //     of 120 px or more keeps its suite number too ("Ste 500 · 6,500 SF", the fact on the line below);
  //  4. a block of 120 px or more stays on the type scale (13 px name, 12 px facts): when a fact does not
  //     fit it falls back one text tier (name and SF) instead of shrinking. Only narrower blocks, and rows
  //     too short for a wrapped 13 px name, use 11 px (and 10 px) as a last resort before the name is given up;
  //  5. a block with no room for its name says its state in a word, so colour is never the only cue.
  /** The layout with the first badge in the top-right corner, on a row of its own, or left out. */
  const solve = (place: 'corner' | 'row' | 'none', suite = false) => {
    const ownRow = place === 'row';
    // `suite`: the SF figure travels with its suite number on a narrow block (print, see `keepSuite`).
    const unit = suite ? text.sub : sfUnit;
    const unitLens = text.lensShort ? `${unit} · ${text.lensShort}` : null;
    // Line budgets: the regular 15 px pitch under 8 px of padding, and a tighter setting used only when it
    // lets a whole name keep its facts. A badge row leaves the text the regular pitch.
    const textH = ownRow ? h - 24 : h;
    const cap15 = Math.max(1, Math.floor((textH - PAD * 2 + 3) / LINE));
    const cap13 = !ownRow && textH >= 3 * CP + 10 ? Math.max(cap15, Math.floor((textH - 12 + 3) / CP)) : cap15;
    /** First baseline and line pitch of an n-line layout. In a block of 120 px or more, a tight layout keeps
        the regular top (so first lines stay aligned along the row) whenever the row leaves it a pitch of
        14 px or more: four lines in a 72 px row. Otherwise it is the compact setting: 6 px of padding, 12.5 px. */
    const geomFor = (n: number, tight: boolean) => {
      if (!tight) return { top: PAD + 11, pitch: LINE };
      const open = tier <= 1 ? Math.min(LINE, Math.floor((textH - PAD - 11 - 9.5) / Math.max(1, n - 1))) : 0;
      return open >= 14 ? { top: PAD + 11, pitch: open } : { top: 6 + 11, pitch: CP };
    };
    // Text on the first line must clear the badges in the top-right corner.
    const reserved = (showOther && place === 'corner' ? badgeW + 6 : 0) + (showSecond ? badge2W + 6 : 0) + (showDeal && !pillBottom ? dealRoom : 0);
    const inner = w - PAD * 2 - reserved;
    // Lines below the first run the full width (the corner badges only occupy the first line); the
    // bottom-right deal pill reserves its corner on the last line instead.
    const innerBody = w - PAD * 2;
    /** Does line i run beside the bottom-right deal pill at this line pitch? */
    const pillHit = (i: number, compact: boolean) => showDeal && pillBottom && (compact ? 17 + CP * i : PAD + 11 + LINE * i) + 3 > h - 22;
    /** Usable width of line i: the first line clears the corner badges; small type runs closer to the edges. */
    const room = (i: number, font: string, compact: boolean) => {
      const pill = pillHit(i, compact) ? 22 : 0;
      const base = (i === 0 ? inner : innerBody) - pill;
      if (i === 0 && reserved) return base;
      if (font === FONT_TINY) return Math.max(base, w - 8 - accentPad - pill);
      if (font === FONT_MICRO) return w - 4 - accentPad - pill;
      return base;
    };
    /** A 12 px fact may run to 4 px from the right edge before it is split, shrunk or dropped. */
    const roomWide = (i: number, compact: boolean) => {
      const base = room(i, FONT_SUB, compact);
      return i === 0 && reserved ? base : Math.max(base, w - PAD - 4 - accentPad - (pillHit(i, compact) ? 22 : 0));
    };
    /** A fact on line i at 12 px; narrow blocks (under 120 px) may step down to 11 and 10 px. */
    const sized = (t: string, i: number, cls: string, compact: boolean): Line | null => {
      if (fits(t, roomWide(i, compact), FONT_SUB)) return { t, cls, font: FONT_SUB };
      if ((tier <= 1 && !suite) || !compact) return null;
      if (fits(t, room(i, FONT_TINY, true), FONT_TINY)) return { t, cls: 'sp-seg__tiny', font: FONT_TINY };
      if (fits(t, room(i, FONT_MICRO, true), FONT_MICRO)) return { t, cls: 'sp-seg__micro', font: FONT_MICRO };
      return null;
    };
    /** Fact lines that can follow n name lines: with the lens fact, with a rate on a line of its own in small type, SF only. */
    const factSets = (n: number, compact: boolean) => {
      const full: Line[][] = [];
      const split: Line[][] = [];
      const sfOnly: Line[][] = [];
      /** "Ste 500 · 6,500 SF", whole or not at all. */
      const subLine = (): Line | null => (fits(text.sub, roomWide(n, compact), FONT_SUB) ? { t: text.sub, cls: 'sp-seg__sub', font: FONT_SUB } : null);
      /** The lens line under it: whole, a rate without "Asking", or its leading parts. A rate is shown whole or
          not at all (dropping the lease type would mislead); other facts may lose trailing parts. */
      const metaLine = (r: number): Line | null => {
        if (!text.meta) return null;
        const isRate = text.meta.includes('$');
        const alt = fits(text.meta, r, FONT_SUB) ? text.meta : isRate ? text.meta.replace(/^Asking /, '') : fitParts(text.meta, r, FONT_SUB);
        return alt && fits(alt, r, FONT_SUB) && (isRate || alt.length >= 4) ? { t: alt, cls: 'sp-seg__meta', font: FONT_SUB } : null;
      };
      // Short rows: SF and the lens fact share one line rather than repeat a date on two.
      // A block with the room keeps its suite number on that line ("Ste 1200 · 9,300 SF · Jun '28"): a row
      // fitted to the window has two lines, and the suite is what a broker quotes. Where the lens has no
      // short fact the whole one follows instead ("Ste 1250 · 9,300 SF · $38–$40/SF/yr FSG", "… · Month-to-month").
      const tail = text.lensShort || text.meta;
      const subLens = tail && !suite ? `${text.sub} · ${tail}` : null;
      const oneLine = (cls: string): Line[] =>
        subLens && fits(subLens, room(n, FONT_SUB, compact), FONT_SUB) ? [{ t: subLens, cls, font: FONT_SUB }] : unitLens && fits(unitLens, room(n, FONT_SUB, compact), FONT_SUB) ? [{ t: unitLens, cls, font: FONT_SUB }] : NONE;
      if (tier === 0) {
        const first: Line = subLine() ?? { t: sfUnit, cls: 'sp-seg__sub', font: FONT_SUB };
        const m = metaLine(room(n + 1, FONT_SUB, compact));
        full.push(m ? [first, m] : NONE);
        full.push(oneLine('sp-seg__sub'));
        sfOnly.push([first]);
      } else {
        const sub = tier === 1 ? subLine() : null;
        const sfL = sized(unit, n, 'sp-seg__sf', compact);
        // 120 px and up: the suite stays, with the lens fact (or its short form) on the line below.
        const m = sub ? metaLine(roomWide(n + 1, compact)) : null;
        full.push(sub && m ? [sub, m] : NONE);
        const short = sub && text.lensShort ? sized(text.lensShort, n + 1, 'sp-seg__meta', compact) : null;
        full.push(sub && short ? [sub, short] : NONE);
        full.push(oneLine('sp-seg__sf'));
        const l = sfL && text.lensShort ? sized(text.lensShort, n + 1, 'sp-seg__meta', compact) : null;
        // When the fact only fits on the line above the deal pill, SF takes the line beside the pill.
        const up = sfL && text.lensShort && !l ? sized(text.lensShort, n, 'sp-seg__meta', compact) : null;
        const sfDown = up ? sized(unit, n + 1, 'sp-seg__sf', compact) : null;
        full.push(sfL && l ? [sfL, l] : up && sfDown ? [up, sfDown] : NONE);
        // Last resort for a rate that is too long for one line at 12 px. A rent is one fact with its unit and
        // its lease type ("$31–$33/SF/yr FSG"): it is never broken inside, so "FSG" never stands alone on a
        // line. The break goes before the rate, which then takes its own line at 11 px, or at 10 px; a
        // block too narrow even for that falls back a tier (name and SF) and the rent stays in the tooltip,
        // the accessible name and the inspector.
        const rate = text.lensShort || (text.meta.includes('$') ? text.meta.replace(/^Asking /, '') : '');
        const head = sub ?? sfL;
        if (head && compact && /^\$\S+\/SF\/(yr|mo) \S+$/.test(rate)) {
          const whole: Line | null = fits(rate, room(n + 1, FONT_TINY, true), FONT_TINY)
            ? { t: rate, cls: 'sp-seg__tiny', font: FONT_TINY }
            : fits(rate, room(n + 1, FONT_MICRO, true), FONT_MICRO)
              ? { t: rate, cls: 'sp-seg__micro', font: FONT_MICRO }
              : null;
          split.push(whole ? [head, whole] : NONE);
        }
        sfOnly.push(sub ? [sub] : sfL ? [sfL] : NONE);
      }
      return { full, split, sfOnly };
    };
    const fit = (ls: Line[], named: boolean) => {
      const small = ls.some(isSmall);
      const cap = small || ls.length > cap15 ? cap13 : cap15;
      return ls.length > 0 && ls.length <= cap ? { lines: ls, compact: small || ls.length > cap15, named } : null;
    };
    // Names: at 13 px on one or two lines; the small sets are the last resort described in rule 4.
    const nameSets: Line[][] = [];
    const smallSets: Line[][] = [];
    if (fits(text.name, inner, FONT_NAME)) nameSets.push([nameLine(text.name)]);
    else {
      const two = wrapWordsVar(text.name, (i) => (i === 0 ? inner : innerBody), FONT_NAME, 2);
      if (two.length && two.join(' ') === text.name) nameSets.push(two.map(lineText).map(nameLine));
      // A row fitted to the window (under 48 px) has one line for a name: it is set at 11 px on that line
      // before the block goes without its name.
      const tiny = wrapWordsVar(text.name, (i) => room(i, FONT_TINY, true), FONT_TINY, h >= 48 ? 3 : 1);
      if (tiny.length && tiny.join(' ') === text.name) smallSets.push(tiny.map((t) => ({ t: lineText(t), cls: 'sp-seg__tiny', font: FONT_TINY })));
      // Narrow tiles: the whole name at 10 px before giving it up.
      const micro = (tier >= 2 || suite) && h >= 48 && seg.kind !== 'unmarketed' ? wrapWords(text.name, room(0, FONT_MICRO, true), FONT_MICRO, 2) : [];
      // With the suite kept, the 10 px name is offered as well as the 11 px one: on one line it leaves room for the suite and the lens fact.
      if (micro.length && micro.join(' ') === text.name && (suite || !(tiny.length && tiny.join(' ') === text.name))) smallSets.push(micro.map((t) => ({ t: lineText(t), cls: 'sp-seg__micro', font: FONT_MICRO })));
    }
    /** The state in a word, for a block that cannot hold its name. */
    const wordLine = (): Line[] => {
      const words = seg.kind === 'unmarketed' && text.name === NOT_ON_MARKET ? [NOT_ON_MARKET] : seg.kind === 'available' && seg.availability?.isVacant && !seg.availableFrom ? ['Available', 'Vacant'] : (STATE_WORD[seg.kind] ?? []);
      for (const t of words) {
        if (fits(t, inner, FONT_NAME)) return [nameLine(t)];
        if (fits(t, room(0, FONT_TINY, true), FONT_TINY)) return [{ t, cls: 'sp-seg__tiny', font: FONT_TINY }];
        if (fits(t, room(0, FONT_MICRO, true), FONT_MICRO)) return [{ t, cls: 'sp-seg__micro', font: FONT_MICRO }];
      }
      return [];
    };
    type Cat = 'full' | 'split' | 'sfOnly';
    /** First layout in a category that fits; widths are computed for the pitch the layout ends up using. */
    const tryCat = (cat: Cat, leads: Line[][], named: boolean, maxLines = 99) => {
      for (const lead of leads) {
        // Richer variants first (suite and months before the one-line form), at the regular pitch before the compact one.
        const sets = [false, true].map((compact) => factSets(lead.length, compact)[cat]);
        for (let i = 0; i < Math.max(sets[0].length, sets[1].length); i += 1)
          for (const compact of [false, true]) {
            const fs = sets[compact ? 1 : 0][i];
            if (!fs || fs.length === 0 || lead.length + fs.length > maxLines) continue;
            // A wrapped 13 px name needs a pitch of 14 px or more; under that the 11 px name is used instead.
            // Not on paper: the report's plan sets every name at one size, so there a name wraps at 13 px at
            // the row's own pitch (12.5 px in its 48 px rows, the pitch of the facts under it) before it is
            // ever set smaller.
            if (compact && lead.length > 1 && lead[0].font === FONT_NAME && !keepSuite && geomFor(lead.length + fs.length, true).pitch < 14) continue;
            const r = fit([...lead, ...fs], named);
            if (r && r.compact === compact) return r;
          }
      }
      return null;
    };
    const cats = (leads: Line[][], named: boolean) => tryCat('full', leads, named) ?? tryCat('split', leads, named, named ? 4 : 99) ?? tryCat('sfOnly', leads, named);
    const pick = () => {
      // 120 px and up: every layout with the 13 px name (down to name and SF) before any with the small one.
      // Narrower blocks keep the lens fact first, at whichever name size carries it. On paper every block
      // puts the 13 px name first: one name size across the plan matters more there than one more fact,
      // which the rent roll on the next page has.
      const all = [...nameSets, ...smallSets];
      const withName = tier <= 1 || keepSuite ? (cats(nameSets, true) ?? cats(smallSets, true)) : (tryCat('full', all, true) ?? tryCat('split', all, true, 4) ?? tryCat('sfOnly', all, true));
      if (withName) return withName;
      // No name fits together with its SF line: the state word (when there is one), SF and the lens fact.
      const wl = wordLine();
      for (const lead of wl.length ? [wl, []] : [[]]) {
        const r = cats([lead], false);
        if (r) return r;
      }
      return wl.length ? fit(wl, false) : null;
    };
    const picked = pick();
    return { picked, cap15, innerBody, ...geomFor(picked?.lines.length ?? 1, picked?.compact ?? false) };
  };
  // Where the badge goes: the first placement that shows the whole name on the type scale. A wide badge
  // tries its own row first; an informational one ("No activity", "Avail Apr '27") is left to the tooltip
  // and the accessible name rather than push the name down to 11 px. A risk badge is never left out: it is
  // the cue for its state. Failing all of that, the corner (or the row, when only the row keeps the name).
  type Solved = ReturnType<typeof solve>;
  const onScale = (r: Solved) => !!r.picked?.named && !r.picked.lines.some(isSmall);
  const corner = solve('corner');
  const row = rowBadge ? solve('row') : null;
  const bare = showOther && !showSecond && other.kind === 'info' && tier <= 1 && !onScale(corner) && !(row && onScale(row)) ? solve('none') : null;
  const place: 'corner' | 'row' | 'none' = row && onScale(row) ? 'row' : onScale(corner) ? 'corner' : bare && onScale(bare) ? 'none' : row?.picked?.named ? 'row' : 'corner';
  const ownRow = place === 'row';
  const drawOther = showOther && place !== 'none';
  const plain = place === 'row' && row ? row : place === 'none' && bare ? bare : corner;
  // Print, narrow block: the same placement with the suite number kept, when that still shows the name (or
  // the plain layout had none to lose) and the suite really is drawn.
  const suited = keepSuite && tier >= 1 && text.sub.startsWith('Ste ') && !plain.picked?.lines.some((l) => l.t.startsWith(text.sub)) ? solve(place, true) : null;
  const useSuited = !!suited?.picked && suited.picked.lines.some((l) => l.t.startsWith(text.sub)) && (suited.picked.named || !plain.picked?.named);
  const chosen = useSuited && suited ? suited : plain;
  // Print: a lease's term ("Exp Feb '27", "Holdover", "Month-to-month") is not given up for want of a line.
  // On paper there is no tooltip to ask, and a box with no date says nothing about a lease ending soon.
  const termed = keepSuite && text.term && tier >= 1 && place !== 'row' && chosen.picked?.named && !termShown(chosen.picked.lines) ? keepTerm(text.term) : null;
  const { picked, cap15, innerBody, pitch, top } = termed ?? chosen;
  /** The deal pill sits in the bottom-right corner on narrow blocks, and where that keeps a term on paper. */
  const pillDown = pillBottom || !!termed?.pillDown;

  /** Do these lines (or the badges drawn beside them) say when the lease ends? */
  function termShown(ls: Line[]): boolean {
    const said = [...ls.map((l) => l.t), drawOther && other ? other.text : '', showSecond && second ? second.text : ''];
    return said.some((t) => !!t && (t.includes(text.term!) || /\bExp\b|Expired|Holdover|Month-to-month|\bMTM\b| left\b/.test(t) || (!!text.lensShort && t.includes(text.lensShort))));
  }

  /**
   * The print layouts that keep the term, tried in order once the usual ones have left it out:
   *  1. the name on one line at 13 px (running to 4 px from the edge, as a fact may; the deal pill moved to
   *     the bottom-right corner if that is what clears it), then suite and SF, then the term;
   *  2. the name wrapped at 13 px, then suite and SF, then the term, where the row has four lines;
   *  3. the name wrapped at 13 px over one merged line, "Ste 100 · 2,400 SF · Exp Feb '27";
   *  4. the same without the "Ste" prefix, "100 · 2,400 SF · Exp Feb '27".
   * Facts may step down to 11 and 10 px; the name is never set smaller (one name size on paper). Null when
   * none fits: the block keeps the layout it had.
   */
  function keepTerm(term: string) {
    const cap = h >= 3 * CP + 10 ? Math.floor((h - 9) / CP) : 0;
    const corner = (drawOther && place === 'corner' ? badgeW + 6 : 0) + (showSecond ? badge2W + 6 : 0);
    const geom = (n: number) => {
      const open = tier <= 1 ? Math.min(LINE, Math.floor((h - PAD - 11 - 9.5) / Math.max(1, n - 1))) : 0;
      return open >= 14 ? { top: PAD + 11, pitch: open } : { top: 6 + 11, pitch: CP };
    };
    /** Room on line i of an n-line layout: from where its type starts to 4 px from the right edge, clear of the badges. */
    const roomAt = (i: number, n: number, font: string, down: boolean) => {
      const g = geom(n);
      const pill = showDeal && (down || pillBottom ? g.top + g.pitch * i + 3 > h - 22 : i === 0) ? 22 : 0;
      const start = font === FONT_MICRO ? 2 : font === FONT_TINY ? 4 : PAD;
      return w - start - 4 - accentPad - pill - (i === 0 ? corner : 0);
    };
    const factAt = (t: string, i: number, n: number, down: boolean, cls: string): Line | null => {
      if (fits(t, roomAt(i, n, FONT_SUB, down), FONT_SUB)) return { t, cls, font: FONT_SUB };
      if (fits(t, roomAt(i, n, FONT_TINY, down), FONT_TINY)) return { t, cls: 'sp-seg__tiny', font: FONT_TINY };
      if (fits(t, roomAt(i, n, FONT_MICRO, down), FONT_MICRO)) return { t, cls: 'sp-seg__micro', font: FONT_MICRO };
      return null;
    };
    const done = (ls: Array<Line | null>, down: boolean) =>
      ls.every(Boolean) && ls.length <= cap ? { picked: { lines: ls as Line[], compact: true, named: true }, cap15: 0, innerBody: w - PAD * 2, ...geom(ls.length), pillDown: down } : null;
    const bare = text.sub.startsWith('Ste ') ? text.sub.slice(4) : null;
    // 1. One line of name.
    for (const down of showDeal && !pillBottom ? [false, true] : [false]) {
      if (!fits(text.name, roomAt(0, 3, FONT_NAME, down), FONT_NAME)) continue;
      const r = done([nameLine(text.name), factAt(text.sub, 1, 3, down, 'sp-seg__sub'), factAt(term, 2, 3, down, 'sp-seg__meta')], down);
      if (r) return r;
    }
    // 2–4. Two lines of name, as the usual layout wraps it.
    const two = wrapWordsVar(text.name, (i) => roomAt(i, 3, FONT_NAME, false), FONT_NAME, 2);
    if (two.length !== 2 || two.join(' ') !== text.name) return null;
    const names = two.map(lineText).map(nameLine);
    return (
      done([...names, factAt(text.sub, 2, 4, false, 'sp-seg__sub'), factAt(term, 3, 4, false, 'sp-seg__meta')], false) ??
      done([...names, factAt(`${text.sub} · ${term}`, 2, 3, false, 'sp-seg__sub')], false) ??
      (bare ? done([...names, factAt(`${bare} · ${term}`, 2, 3, false, 'sp-seg__sub')], false) : null)
    );
  }
  const lines: Line[] = picked?.lines ?? [];
  const compactPitch = picked?.compact ?? false;
  if (extra && picked && !compactPitch) {
    for (const e of extra) {
      if (lines.length >= cap15) break;
      if (lines.some((l) => l.t.includes(e))) continue;
      if (fits(e, innerBody, FONT_SUB)) lines.push({ t: e, cls: 'sp-seg__meta', font: FONT_SUB });
      else {
        // Too long for one line: two whole lines, or not at all.
        const two = wrapWords(e, innerBody, FONT_SUB, 2);
        if (two.join(' ') === e && lines.length + two.length <= cap15) for (const t of two) lines.push({ t: lineText(t), cls: 'sp-seg__meta', font: FONT_SUB });
      }
    }
  }
  const lineX = (l: Line) => (l.cls === 'sp-seg__micro' ? 2 : l.cls === 'sp-seg__tiny' ? 4 : PAD) + accentPad;
  // Narrowest tier: a single state glyph so colour is never the only cue.
  const glyph = lines.length === 0 && w >= 24 && h >= 40 ? (GLYPH[seg.kind] ?? null) : null;

  const pattern = text.pattern;
  const patternFill = pattern === 'hatch' ? `url(#${PATTERN_IDS.hatch})` : pattern === 'dots' ? `url(#${PATTERN_IDS.dots})` : pattern === 'asking' ? `url(#${PATTERN_IDS.asking})` : null;
  // Accessible name: floor, the full name when it is not drawn, exactly what is drawn (WCAG 2.5.3), then
  // the facts that are not drawn. Nothing is said twice.
  const drawn = [...lines.map((l) => l.t), showSecond && second ? second.text : '', drawOther && other ? other.text : ''].filter(Boolean);
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
      data-kind={seg.kind}
      transform={`translate(${x} ${y})`}
      onClick={onSelect}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      style={{ color: edge }}
    >
      <title>{text.tooltip + (enlarged ? '\nDrawn at minimum width for legibility' : '')}</title>
      <rect className="sp-seg__ring" x={-3} y={-3} width={w + 6} height={h + 6} rx={7} />
      {/* Inset by half a pixel so the 1 px edge lands on whole pixels: the boundary is painted in the edge
          colour itself, not a 50% blend of it with the card and the fill. */}
      <rect className="sp-seg__rect" x={0.5} y={0.5} width={Math.max(0, w - 1)} height={Math.max(0, h - 1)} rx={4} fill={fill} stroke={edge} />
      {w > 16 && <rect className="sp-seg__gloss" x={5} y={1.2} width={w - 10} height={1} rx={0.5} />}
      {patternFill && <rect className="sp-seg__pattern" x={1} y={1} width={Math.max(0, w - 2)} height={Math.max(0, h - 2)} rx={3} fill={patternFill} pointerEvents="none" />}
      {patternFill && lines.length > 0 &&
        (tone === 'empty' || tone === 'deal-none' ? [{ f: 'var(--sp-color-card)', o: 0.9 }] : [{ f: fill, o: 0.9 }]).map((layer, i) => (
          <rect
            key={i}
            className="sp-seg__backing"
            x={Math.max(1, Math.min(...lines.map(lineX)) - 4)}
            y={top - 11 - 3}
            width={Math.min(w - 2, Math.ceil(Math.max(...lines.map((l) => measure(l.t, l.font)))) + 8)}
            height={lines.length * pitch + 4}
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
      {lines.map((l, i) => (
        <text key={i} className={l.cls} x={lineX(l)} y={top + i * pitch} fill={color}>
          {`${l.t} `}
        </text>
      ))}
      {showSecond && second && (
        <g className={`sp-badge sp-badge--${second.kind}`} transform={`translate(${w - badgeW - 6 - (showDeal && !pillDown ? dealRoom : 0) - badge2W - 6} 6)`}>
          <title>{second.title ?? second.text}</title>
          <rect width={badge2W} height={16} rx={8} />
          <text x={badge2W / 2} y={11.5} textAnchor="middle">
            {`${second.text} `}
          </text>
        </g>
      )}
      {drawOther && other && (
        <g className={`sp-badge sp-badge--${other.kind}`} transform={ownRow ? `translate(${PAD + accentPad} ${h - PAD - 16})` : `translate(${w - badgeW - 6 - (showDeal && !pillDown ? dealRoom : 0)} 6)`}>
          <title>{other.title ?? other.text}</title>
          <rect width={badgeW} height={16} rx={8} />
          <text x={badgeW / 2} y={11.5} textAnchor="middle">
            {`${other.text} `}
          </text>
        </g>
      )}
      {showDeal && deal && (
        <g className="sp-badge sp-badge--deal" transform={`translate(${w - dealW - 6} ${pillDown ? h - 22 : 6})`}>
          <title>{deal.title}</title>
          <rect width={dealW} height={16} rx={8} />
          <text x={dealW / 2} y={11.5} textAnchor="middle">
            {`${dealWords ?? deal.text} `}
          </text>
        </g>
      )}
    </g>
  );
}
