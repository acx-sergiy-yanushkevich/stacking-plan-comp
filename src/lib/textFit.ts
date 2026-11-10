/**
 * Text measurement for SVG labels. Uses one shared canvas; results are memoised per font+text.
 * Falls back to an average-glyph estimate when canvas is unavailable (tests, SSR).
 */
const cache = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null | undefined;

function context(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx;
  try {
    ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  } catch {
    ctx = null;
  }
  return ctx;
}

/**
 * The app sets every label in tabular figures (`font-variant-numeric: tabular-nums`, base.css), which a
 * canvas cannot be told about. In Inter that feature changes the advance of the digits and of some
 * punctuation (a "1" and a hyphen are each over 2 px wider at 12 px), so the canvas measures
 * "Ste 1100 · 10,400 SF" about 9 px short of what is drawn. Each affected character is corrected by the
 * difference between its tabular advance, read once per font from a hidden element, and its canvas
 * advance. No correction where there is no layout (tests, SSR).
 */
const TABULAR = /[0-9()*+,\-.:;<=>[\]{}~]/g;
const deltas = new Map<string, Map<string, number>>();
let probe: HTMLSpanElement | null | undefined;
function tabularDelta(c: CanvasRenderingContext2D, font: string, ch: string): number {
  let byChar = deltas.get(font);
  if (!byChar) deltas.set(font, (byChar = new Map()));
  const hit = byChar.get(ch);
  if (hit !== undefined) return hit;
  let d = 0;
  try {
    if (probe === undefined) {
      probe = typeof document !== 'undefined' && document.body ? document.createElement('span') : null;
      if (probe) {
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;pointer-events:none';
        document.body.appendChild(probe);
      }
    }
    if (probe) {
      probe.style.font = font;
      probe.style.fontVariantNumeric = 'tabular-nums';
      probe.textContent = ch.repeat(10);
      const drawn = probe.getBoundingClientRect().width / 10;
      c.font = font;
      if (drawn > 0) d = drawn - c.measureText(ch).width;
    }
  } catch {
    d = 0;
  }
  byChar.set(ch, d);
  return d;
}

export function measure(text: string, font: string): number {
  const key = font + '\u0000' + text;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const c = context();
  let w: number;
  if (c) {
    c.font = font;
    w = c.measureText(text).width;
    const affected = text.match(TABULAR);
    if (affected) for (const ch of affected) w += tabularDelta(c, font, ch);
  } else {
    const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 13);
    w = text.length * size * 0.55;
  }
  cache.set(key, w);
  return w;
}

/** Longest prefix of whole words that fits in `maxPx`; '' when even the first word does not fit. */
export function fitWords(text: string, maxPx: number, font: string): string {
  if (measure(text, font) <= maxPx) return text;
  const words = text.split(' ');
  let out = '';
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (measure(next, font) > maxPx) break;
    out = next;
  }
  return out;
}

/** Wrap into at most `maxLines` lines of whole words; returns [] when the first word does not fit. */
export function wrapWords(text: string, maxPx: number, font: string, maxLines: number): string[] {
  const words = text.split(' ').filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next, font) <= maxPx) {
      cur = next;
    } else {
      if (!cur) return lines; // a single word is too wide: give up rather than truncate it
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) return lines;
      if (measure(cur, font) > maxPx) return lines;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

/** Like `wrapWords`, with a width per line (the first line of a block may be shorter than the rest). */
export function wrapWordsVar(text: string, widthOf: (line: number) => number, font: string, maxLines: number): string[] {
  const words = text.split(' ').filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next, font) <= widthOf(lines.length)) {
      cur = next;
    } else {
      if (!cur) return lines;
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) return lines;
      if (measure(cur, font) > widthOf(lines.length)) return lines;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

export const fits = (text: string, maxPx: number, font: string) => measure(text, font) <= maxPx;

/** Longest prefix of " · "-separated parts that fits; a part is never split. */
export function fitParts(text: string, maxPx: number, font: string): string {
  if (measure(text, font) <= maxPx) return text;
  const parts = text.split(' · ');
  let out = '';
  for (const part of parts) {
    const next = out ? `${out} · ${part}` : part;
    if (measure(next, font) > maxPx) break;
    out = next;
  }
  return out;
}

/**
 * Web fonts load after first paint (font-display: swap). Widths measured before then come from the
 * fallback face, so the cache is dropped and subscribers re-render when a font finishes loading.
 */
let fontEpoch = 0;
const fontListeners = new Set<() => void>();
export const getFontEpoch = () => fontEpoch;
export function subscribeFonts(cb: () => void): () => void {
  fontListeners.add(cb);
  return () => fontListeners.delete(cb);
}
if (typeof document !== 'undefined' && document.fonts) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bump = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      cache.clear();
      deltas.clear();
      fontEpoch += 1;
      fontListeners.forEach((l) => l());
    }, 30);
  };
  document.fonts.ready.then(bump).catch(() => undefined);
  document.fonts.addEventListener?.('loadingdone', bump);
}
