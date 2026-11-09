// Real Chrome PDFs of the print layout. Usage: node scripts/pdf.mjs <outDir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'docs/shots/latest/pdf';
const base = process.env.BASE ?? 'http://localhost:4180/';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, reducedMotion: 'reduce' });
for (const [name, qs] of [
  ['owner-report', '?view=stack&print=1'],
  ['owner-report-expiry', '?view=stack&lens=expiry&print=1'],
  ['prospect-safe-report', '?view=stack&safe=1&print=1'],
]) {
  await page.goto(base + qs, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(400);
  await page.pdf({ path: `${out}/${name}.pdf`, format: 'Letter', landscape: true, printBackground: true, margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' } });
  console.log('wrote', `${out}/${name}.pdf`);
}
await browser.close();
