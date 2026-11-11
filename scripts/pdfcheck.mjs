// Checks the printed report as Chrome really paginates it. Each report is printed to a PDF the ways a
// person can print it, and the PDF is read back (scripts/pdfread.mjs):
//
//  - no page is nearly empty: on every page the text reaches at least MIN_FILL of the way down;
//  - the running heads count what is printed: "Section n of N" runs 1…N with no gap, and N is the number
//    of sections in the report (read from the page that was printed);
//  - the cover is whole: the plan, its legend and its footnote are all on page 1;
//  - the report does not depend on the screen: printed from the preview at three window widths, and from
//    the app itself (Export → PDF report prints the app, not the preview), it has the same pages.
//
// Usage: node scripts/pdfcheck.mjs [outDir]   (BASE=http://localhost:4180/ by default)
import { chromium } from 'playwright';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDF_OPTIONS, REPORTS, measureReport } from './pdfread.mjs';

const MIN_FILL = 0.15;
const base = process.env.BASE ?? 'http://localhost:4180/';
const out = process.argv[2] ?? mkdtempSync(join(tmpdir(), 'sp-pdfcheck-'));
mkdirSync(out, { recursive: true });

// How a report gets printed: the preview link at a window width, or the app as the user has it open.
const WAYS = [
  { id: 'preview-1400', width: 1400, preview: true },
  { id: 'preview-1100', width: 1100, preview: true },
  { id: 'preview-1920', width: 1920, preview: true },
  { id: 'app-1440', width: 1440, preview: false },
  { id: 'app-phone-390', width: 390, preview: false },
];

const browser = await chromium.launch({ channel: 'chrome' });
const fails = [];
const check = (cond, msg) => (cond ? console.log('ok  ', msg) : (fails.push(msg), console.log('FAIL', msg)));

for (const [name, qs] of REPORTS) {
  const shapes = [];
  for (const way of WAYS) {
    const label = `${name} · ${way.id}`;
    const page = await browser.newPage({ viewport: { width: way.width, height: 1000 }, reducedMotion: 'reduce' });
    await page.goto(base + (way.preview ? qs : qs.replace(/[?&]print=1/, '')), { waitUntil: 'networkidle' });
    if (way.preview) await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(400);
    // The real section count: the sections the report is made of, whether or not they are on screen.
    const sections = await page.evaluate(() => document.querySelectorAll('.sp-print .sp-print__page').length);
    const path = `${out}/${name}.${way.id}.pdf`;
    await page.pdf({ path, ...PDF_OPTIONS });
    await page.close();

    const pages = measureReport(readFileSync(path));
    const fills = pages.map((p) => `${Math.round(p.fill * 100)}%`).join(', ');
    console.log(`     ${label}: ${pages.length} pages, ${sections} sections, filled ${fills}`);
    shapes.push(`${pages.length} pages / ${sections} sections`);

    const thin = pages.map((p, i) => ({ i, fill: p.fill, lines: p.lines })).filter((p) => p.fill < MIN_FILL);
    check(thin.length === 0, `${label}: every page is at least ${MIN_FILL * 100}% full${thin.map((p) => ` (page ${p.i + 1} is ${Math.round(p.fill * 100)}%: “${p.lines.join(' ').slice(0, 70)}”)`).join('')}`);

    const heads = pages.flatMap((p) => p.sections);
    const counted = heads.length > 0 && heads.every((h, i) => h.n === i + 1 && h.of === sections) && heads.length === sections;
    check(counted, `${label}: the running heads read Section 1…${sections} of ${sections} (found ${heads.map((h) => `${h.n} of ${h.of}`).join(', ') || 'none'})`);
    check(pages.every((p) => p.sections.length > 0), `${label}: every page starts a section or continues one under its head${pages.map((p, i) => (p.sections.length ? '' : ` (page ${i + 1} has no head)`)).join('')}`);

    const cover = (pages[0]?.lines ?? []).join('\n');
    const floors = new Set([...cover.matchAll(/Ste\s+(\d+)/g)].map((m) => m[1])).size;
    check(/Floor width is proportional/.test(cover) && floors >= 10, `${label}: page 1 holds the plan (${floors} suites named) with its footnote`);
    check(pages.length <= sections, `${label}: no section spills onto a page of its own (${pages.length} pages for ${sections} sections)`);
  }
  check(new Set(shapes).size === 1, `${name}: the same pages however it is printed (${[...new Set(shapes)].join(' ≠ ')})`);
}

await browser.close();
if (fails.length) {
  console.error(`\n${fails.length} check(s) failed · PDFs in ${out}`);
  process.exit(1);
}
console.log(`\nall checks passed · PDFs in ${out}`);
