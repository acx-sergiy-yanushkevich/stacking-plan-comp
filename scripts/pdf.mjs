// Real Chrome PDFs of the print layout. Usage: node scripts/pdf.mjs <outDir>
// Each file is read back and its pages are listed with how full they are; `npm run pdfcheck` is the test.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { PDF_OPTIONS, REPORTS, measureReport } from './pdfread.mjs';

const out = process.argv[2] ?? 'docs/shots/latest/pdf';
const base = process.env.BASE ?? 'http://localhost:4180/';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, reducedMotion: 'reduce' });
for (const [name, qs] of REPORTS) {
  await page.goto(base + qs, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(400);
  const path = `${out}/${name}.pdf`;
  await page.pdf({ path, ...PDF_OPTIONS });
  const pages = measureReport(readFileSync(path));
  console.log('wrote', path, `· ${pages.length} pages · filled ${pages.map((p) => `${Math.round(p.fill * 100)}%`).join(', ')}`);
}
await browser.close();
