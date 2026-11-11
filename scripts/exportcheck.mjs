// Export check, in a real browser: the PNG of the plan and the rent-roll CSV, as the broker (owner
// mode) and in prospect-safe mode, on a desktop and on a phone. Unit tests cannot see either file:
// both are made by the browser (an SVG serialised and drawn on a canvas; a Blob handed to a download).
//
// PNG: the download must exist, be a real PNG of the size the plan is drawn at (2×), and still carry
// the patterns that say what colour alone does not: the dots of the sublet suite on Floor 7 and the
// hatching of the signed lease on Floor 4. A pattern is a `<pattern>` defined outside the plan's SVG;
// if it is not carried into the image the suite comes out as one flat colour. So the pixels of each
// patterned suite must vary, and those of an ordinary leased suite (the control) must not.
// CSV: a header and one row per suite, with tenant names for the broker and none for a prospect.
//
// Usage: BASE=http://localhost:5190/ node scripts/exportcheck.mjs   (exits 1 on any failure)
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const base = process.env.BASE ?? 'http://localhost:4180/';
const fails = [];
const check = (cond, msg) => (cond ? console.log('ok  ', msg) : (fails.push(msg), console.log('FAIL', msg)));

/** Decode an 8-bit RGB or RGBA, non-interlaced PNG (what a canvas writes) to { width, height, at(x, y) → [r, g, b] }. */
function decodePng(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) throw new Error('not a PNG file');
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];
  for (let p = 8; p < buf.length; ) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const [depth, colour, , , interlace] = data.subarray(8);
      if (depth !== 8 || (colour !== 6 && colour !== 2) || interlace !== 0) throw new Error(`unsupported PNG (depth ${depth}, colour type ${colour}, interlace ${interlace})`);
      channels = colour === 6 ? 4 : 3;
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= channels ? px[row + x - channels] : 0;
      const b = y > 0 ? px[row - stride + x] : 0;
      const c = x >= channels && y > 0 ? px[row - stride + x - channels] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[row + x] = (v + pred) & 255;
    }
  }
  return { width, height, at: (x, y) => [px[y * stride + x * channels], px[y * stride + x * channels + 1], px[y * stride + x * channels + 2]] };
}

/**
 * How much the pixels of a region vary: the number of distinct colours and the largest difference in
 * any channel. A flat fill is 1 colour and 0; dots (a few crisp colours) or hatching (many, anti-aliased)
 * are several colours and a clear difference.
 */
function variation(png, box) {
  const colours = new Set();
  let lo = [255, 255, 255];
  let hi = [0, 0, 0];
  for (let y = Math.max(0, Math.floor(box.y)); y < Math.min(png.height, Math.ceil(box.y + box.h)); y++) {
    for (let x = Math.max(0, Math.floor(box.x)); x < Math.min(png.width, Math.ceil(box.x + box.w)); x++) {
      const c = png.at(x, y);
      colours.add(c.join(','));
      lo = lo.map((v, i) => Math.min(v, c[i]));
      hi = hi.map((v, i) => Math.max(v, c[i]));
    }
  }
  return { colours: colours.size, spread: Math.max(...hi.map((v, i) => v - lo[i])) };
}

/**
 * Where three suites sit inside the plan SVG, in CSS px: the sublet suite, the signed lease and an
 * ordinary leased suite. Each box is the right-hand part of the block below its badges, where no text
 * is drawn, so what varies there is the pattern and nothing else. On a screen with no stack the plan
 * is the one the export draws off-screen: it is asked for the same way the export asks, measured, and
 * released.
 */
const measure = (page) =>
  page.evaluate(async () => {
    const onScreen = [...document.querySelectorAll('.sp-stage .sp-stack__body > svg')].find((s) => s.getBoundingClientRect().width >= 1);
    let plan = null;
    if (!onScreen) {
      let answer = null;
      window.__spPlanSvg?.emit({ provide: (p) => (answer = p) });
      if (!answer) return { error: 'no plan on screen and nothing answered the request for one' };
      plan = await answer;
    }
    const svg = onScreen ?? plan.svg;
    const frame = svg.getBoundingClientRect();
    const blocks = [...svg.querySelectorAll('[data-key]')];
    const named = (re) => blocks.find((b) => re.test(b.getAttribute('aria-label') ?? ''));
    // The clear part of a block: its right third, from 45% of its height down, inset from the edges.
    const clear = (el) => {
      if (!el) return null;
      const r = (el.querySelector('.sp-seg__rect') ?? el).getBoundingClientRect();
      return { x: r.left - frame.left + r.width * 0.72, y: r.top - frame.top + r.height * 0.5, w: r.width * 0.24, h: r.height * 0.4 };
    };
    const out = {
      width: frame.width,
      height: frame.height,
      source: onScreen ? 'the plan on screen' : 'the plan drawn off-screen',
      sublease: clear(svg.querySelector('[data-key="L14-U2"]')),
      committed: clear(named(/Signed, not in/)),
      // The widest ordinary lease: Floor 10, one tenant across the floor.
      leased: clear(named(/Ste 1000\b/)),
    };
    plan?.release();
    return out;
  });

async function exportFile(page, item) {
  await page.getByRole('button', { name: 'Export' }).click();
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), page.getByRole('menuitem', { name: item }).click()]);
  await page.waitForTimeout(250);
  const toast = (await page.locator('.sp-toasts').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  if (!download) return { toast, name: null, bytes: null };
  return { toast, name: download.suggestedFilename(), bytes: readFileSync(await download.path()) };
}

const browser = await chromium.launch({ channel: 'chrome' });
const cases = [
  ['desktop, Stack, owner', { width: 1440, height: 1100 }, '?view=stack', false],
  ['desktop, Stack, prospect-safe', { width: 1440, height: 1100 }, '?view=stack&safe=1', true],
  ['desktop, Building (no stack on screen), owner', { width: 1440, height: 1100 }, '', false],
  ['desktop, Stack, day theme, owner', { width: 1440, height: 1100 }, '?view=stack&theme=light', false],
  ['phone, Stack, owner', { width: 390, height: 844 }, '?view=stack', false],
  ['phone, Stack, prospect-safe', { width: 390, height: 844 }, '?view=stack&safe=1', true],
  ['phone, Timeline, owner', { width: 390, height: 844 }, '?view=timeline', false],
];

for (const [label, viewport, qs, safe] of cases) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + qs, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  // ── PNG ────────────────────────────────────────────────────────────────────────────────────────
  const where = await measure(page);
  if (where.error || !where.sublease || !where.committed || !where.leased) {
    check(false, `${label}: PNG: the plan could not be measured (${where.error ?? 'a suite was not found'})`);
  } else {
    const png = await exportFile(page, /PNG of the plan/);
    check(png.bytes !== null, `${label}: PNG downloads (toast: "${png.toast}")`);
    if (png.bytes) {
      check(png.bytes.length > 20000, `${label}: PNG is not empty (${png.bytes.length.toLocaleString('en-US')} bytes)`);
      check(/^stacking-plan-.*\.png$/.test(png.name) && png.name.includes('prospect-safe') === safe, `${label}: PNG file name says what it is (${png.name})`);
      check(/exported/i.test(png.toast) && !/failed/i.test(png.toast), `${label}: the toast reports the export ("${png.toast}")`);
      let image = null;
      try {
        image = decodePng(png.bytes);
      } catch (e) {
        check(false, `${label}: PNG decodes (${e.message})`);
      }
      if (image) {
        const scale = image.width / where.width;
        check(Math.abs(scale - 2) < 0.02 && Math.abs(image.height / where.height - 2) < 0.02, `${label}: PNG is ${where.source} at 2× (${image.width}×${image.height} px for ${Math.round(where.width)}×${Math.round(where.height)})`);
        check(image.width >= 1600, `${label}: PNG is wide enough for a slide (${image.width} px)`);
        const box = (b) => ({ x: b.x * scale, y: b.y * scale, w: b.w * scale, h: b.h * scale });
        const dots = variation(image, box(where.sublease));
        const hatch = variation(image, box(where.committed));
        const flat = variation(image, box(where.leased));
        check(dots.colours >= 3 && dots.spread >= 12, `${label}: the sublet suite on Floor 7 has its dots (${dots.colours} colours, spread ${dots.spread})`);
        check(hatch.colours >= 3 && hatch.spread >= 12, `${label}: the signed lease on Floor 4 has its hatching (${hatch.colours} colours, spread ${hatch.spread})`);
        check(flat.colours <= 3 && flat.spread <= 4, `${label}: an ordinary leased suite is a flat fill, so the variation above is the pattern (${flat.colours} colours, spread ${flat.spread})`);
      }
    }
  }

  // ── CSV ────────────────────────────────────────────────────────────────────────────────────────
  const csv = await exportFile(page, /Rent roll \(CSV\)/);
  check(csv.bytes !== null, `${label}: CSV downloads (toast: "${csv.toast}")`);
  if (csv.bytes) {
    const text = csv.bytes.toString('utf8').replace(/^﻿/, '');
    const rows = text.split(/\r?\n/).filter(Boolean);
    const header = rows[0]?.split(',') ?? [];
    check(/^rent-roll-.*\.csv$/.test(csv.name) && csv.name.includes('prospect-safe') === safe, `${label}: CSV file name says what it is (${csv.name})`);
    check(rows.length >= 25 && header[0] === 'Floor' && header.includes('RSF') && header.includes('State'), `${label}: CSV has a header and a row per suite (${rows.length - 1} rows)`);
    check(header.includes('Live deals') === !safe, `${label}: CSV ${safe ? 'has no' : 'has the'} Live deals column`);
    const tenants = new Set(rows.slice(1).map((r) => r.split(',')[header.indexOf('Tenant')]).filter(Boolean));
    if (safe) {
      check([...tenants].every((t) => t === 'Tenant'), `${label}: CSV names no tenant (${[...tenants].join(', ')})`);
      check(!/\b\d{4}-\d{2}-\d{2}\b/.test(text), `${label}: CSV holds no date`);
    } else {
      check(tenants.size >= 10 && tenants.has('Cirrus Energy'), `${label}: CSV names the tenants (${tenants.size})`);
      check(/\b\d{4}-\d{2}-\d{2}\b/.test(text), `${label}: CSV holds the lease dates`);
    }
    check(rows.slice(1).some((r) => /,Sublease,/.test(r)) && rows.slice(1).some((r) => /,Committed,/.test(r)), `${label}: CSV has the sublease and the signed lease`);
  }
  check(errors.length === 0, `${label}: no console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await context.close();
}

await browser.close();
if (fails.length) {
  console.error(`\n${fails.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall export checks passed');
