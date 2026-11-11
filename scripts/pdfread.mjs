// Reads a PDF written by Chrome: how many pages it has, the text on each, and how far down each page
// the text reaches. Enough of the format for that and no more; it has no dependency.
//
// Chrome (Skia) writes every object in the clear, compresses each stream with Flate, gives a page one
// content stream and draws text with Type 3 fonts that each carry a ToUnicode map. A content stream is
// read with a graphics-state stack (q, Q, cm) and the text operators (BT, Tf, Tm, Td, TD, T*, Tj, TJ).
import { inflateSync } from 'node:zlib';

const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];

/** Every object of the file: its dictionary text and, if it has one, its inflated stream. */
function objects(buf) {
  const text = buf.toString('latin1');
  const out = new Map();
  const re = /(\d+) 0 obj\b/g;
  for (let m; (m = re.exec(text)); ) {
    const end = text.indexOf('endobj', m.index);
    const body = text.slice(m.index + m[0].length, end);
    const at = body.indexOf('stream');
    if (at < 0) {
      out.set(Number(m[1]), { dict: body });
      continue;
    }
    const dict = body.slice(0, at);
    const length = Number(/\/Length (\d+)/.exec(dict)?.[1] ?? 0);
    let start = m.index + m[0].length + at + 'stream'.length;
    start += text[start] === '\r' ? 2 : 1;
    const raw = buf.subarray(start, start + length);
    let stream = raw;
    if (/\/FlateDecode/.test(dict)) {
      try {
        stream = inflateSync(raw);
      } catch {
        stream = Buffer.alloc(0);
      }
    }
    out.set(Number(m[1]), { dict, stream });
    re.lastIndex = start + length;
  }
  return out;
}

/** A font's ToUnicode map: glyph code (hex, upper case) → text. */
function toUnicode(cmap) {
  const map = new Map();
  const hex = (h) => String.fromCodePoint(...(h.match(/.{4}/g) ?? []).map((u) => parseInt(u, 16)));
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const m of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) map.set(m[1].toUpperCase(), hex(m[2]));
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const from = parseInt(m[1], 16);
      const to = parseInt(m[2], 16);
      for (let c = from; c <= to; c++) map.set(c.toString(16).toUpperCase().padStart(m[1].length, '0'), String.fromCodePoint(parseInt(m[3], 16) + c - from));
    }
  }
  return map;
}

/** The glyph runs of one content stream: text, and where its baseline starts in PDF points from the page's top left. */
function runs(content, fonts, pageHeight) {
  const out = [];
  const stack = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  let tm = [1, 0, 0, 1, 0, 0];
  let line = tm;
  let font = null;
  let leading = 0;
  const args = [];
  const show = (hexes) => {
    const map = fonts.get(font);
    const width = font && map ? map.width : 2;
    let text = '';
    for (const h of hexes) for (const code of h.toUpperCase().match(new RegExp(`.{${width}}`, 'g')) ?? []) text += map?.get(code) ?? '';
    if (!text) return;
    const [, , , , x, y] = mul(tm, ctm);
    out.push({ text, x, y: pageHeight - y });
  };
  const token = /<([0-9A-Fa-f\s]*)>|\[([^\]]*)\]|\(((?:\\.|[^\\)])*)\)|\/[^\s/<>[\]()]+|[-+]?\d*\.?\d+|[A-Za-z'"*]+/g;
  for (let m; (m = token.exec(content)); ) {
    const t = m[0];
    if (m[1] !== undefined || m[2] !== undefined || m[3] !== undefined || t[0] === '/' || /^[-+.\d]/.test(t)) {
      args.push(t);
      continue;
    }
    const n = args.map(Number);
    if (t === 'q') stack.push(ctm);
    else if (t === 'Q') ctm = stack.pop() ?? ctm;
    else if (t === 'cm') ctm = mul(n.slice(-6), ctm);
    else if (t === 'BT') tm = line = [1, 0, 0, 1, 0, 0];
    else if (t === 'Tf') font = args[args.length - 2];
    else if (t === 'TL') leading = n[n.length - 1];
    else if (t === 'Tm') tm = line = n.slice(-6);
    else if (t === 'Td' || t === 'TD') {
      if (t === 'TD') leading = -n[n.length - 1];
      tm = line = mul([1, 0, 0, 1, n[n.length - 2], n[n.length - 1]], line);
    } else if (t === 'T*') tm = line = mul([1, 0, 0, 1, 0, -leading], line);
    else if (t === 'Tj') show([args[args.length - 1].replace(/[<>\s]/g, '')]);
    else if (t === 'TJ') show([...args[args.length - 1].matchAll(/<([0-9A-Fa-f\s]*)>/g)].map((h) => h[1].replace(/\s/g, '')));
    args.length = 0;
  }
  return out;
}

/**
 * The pages of a PDF, in order. Each has its size in points, its text as lines (top to bottom, left to
 * right) and `bottom`: how far down the page the lowest line of text stands, in points from the top.
 */
export function readPdf(buf) {
  const objs = objects(buf);
  const ref = (dict, key) => Number(new RegExp(`/${key} (\\d+) 0 R`).exec(dict)?.[1] ?? NaN);
  const pages = [];
  // Page objects are written in page order by Chrome; the page tree's /Kids confirms it when present.
  const pageIds = [...objs].filter(([, o]) => /\/Type\s*\/Page\b(?!s)/.test(o.dict)).map(([id]) => id);
  const kids = [...objs.values()].map((o) => (/\/Type\s*\/Pages\b/.test(o.dict) ? /\/Kids\s*\[([^\]]*)\]/.exec(o.dict)?.[1] : null)).find(Boolean);
  const order = kids ? [...kids.matchAll(/(\d+) 0 R/g)].map((m) => Number(m[1])).filter((id) => pageIds.includes(id)) : pageIds;
  for (const id of order.length === pageIds.length ? order : pageIds) {
    const { dict } = objs.get(id);
    const box = /\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/.exec(dict);
    const width = box ? Number(box[3]) - Number(box[1]) : 792;
    const height = box ? Number(box[4]) - Number(box[2]) : 612;
    const fonts = new Map();
    const fontDict = /\/Font\s*<<([^>]*)>>/.exec(dict)?.[1] ?? '';
    for (const f of fontDict.matchAll(/(\/[^\s/]+) (\d+) 0 R/g)) {
      const cmap = objs.get(ref(objs.get(Number(f[2]))?.dict ?? '', 'ToUnicode'))?.stream?.toString('latin1') ?? '';
      const map = toUnicode(cmap);
      map.width = Math.max(2, ...[...map.keys()].map((k) => k.length).filter((n) => typeof n === 'number'));
      fonts.set(f[1], map);
    }
    const content = objs.get(ref(dict, 'Contents'))?.stream?.toString('latin1') ?? '';
    const glyphs = runs(content, fonts, height).filter((g) => g.text.trim() !== '' || g.text === ' ');
    // Lines: runs whose baselines are within a point of each other, left to right.
    const lines = [];
    for (const g of [...glyphs].sort((a, b) => a.y - b.y || a.x - b.x)) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y - g.y) <= 1) last.parts.push(g);
      else lines.push({ y: g.y, parts: [g] });
    }
    const text = lines.map((l) => l.parts.sort((a, b) => a.x - b.x).map((g) => g.text).join('').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const inked = glyphs.filter((g) => g.text.trim() !== '');
    pages.push({ width, height, lines: text, text: text.join('\n'), bottom: inked.length ? Math.max(...inked.map((g) => g.y)) : 0, top: inked.length ? Math.min(...inked.map((g) => g.y)) : 0 });
  }
  return pages;
}

/** The three reports the app prints, as the links that open their preview. */
export const REPORTS = [
  ['owner-report', '?view=stack&print=1'],
  ['owner-report-expiry', '?view=stack&lens=expiry&print=1'],
  ['prospect-safe-report', '?view=stack&safe=1&print=1'],
];

/** The paper every report is printed on: US Letter, landscape, a 12 mm margin (the `@page` rule in styles/print.css). */
export const MARGIN_MM = 12;
export const PDF_OPTIONS = { format: 'Letter', landscape: true, printBackground: true, margin: { top: `${MARGIN_MM}mm`, right: `${MARGIN_MM}mm`, bottom: `${MARGIN_MM}mm`, left: `${MARGIN_MM}mm` } };

/**
 * What a report's pages hold, measured: for each page the share of its height (inside the margins) that
 * the text reaches down to, and the "Section n of N" of every running head on it.
 */
export function measureReport(buf) {
  const margin = (MARGIN_MM / 25.4) * 72;
  return readPdf(buf).map((page) => ({
    fill: Math.max(0, Math.min(1, (page.bottom - margin) / (page.height - 2 * margin))),
    sections: [...page.text.matchAll(/Section (\d+) of (\d+)/g)].map((m) => ({ n: Number(m[1]), of: Number(m[2]) })),
    lines: page.lines,
  }));
}
