// Prospect-safe leak check: with safe=1, no tenant, contact or prospect name and no in-place
// rent may appear anywhere in the DOM text, title, aria-labels or SVG <title>s.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:4180/';
const src = readFileSync(new URL('../src/data/mock/property.ts', import.meta.url), 'utf8');
const names = new Set();
for (const re of [/tenant: '([^']+)'/g, /tenantContact: '([^']+)'/g, /deal\('([^']+)'/g, /prospect: '([^']+)'/g, /owner: '([^']+)'/g, /by: '([^']+)'/g, /broker: '([^']+)'/g]) {
  for (const m of src.matchAll(re)) names.add(m[1]);
}
// Property-level names that legitimately stay visible.
for (const ok of ['Lakeside Realty Partners', 'Preston Park Financial Center']) names.delete(ok);
// In-place lease rates render as a single value "$29/SF/yr FSG"; asking rents are ranges "$31–$33/SF/yr".
const inPlaceRent = /(?<![–-])\$\d[\d.,]*\/SF\/(yr|mo)\s(FSG|MG|NNN)/;

const states = [
  '?view=stack&safe=1',
  '?view=stack&safe=1&lens=rent',
  '?view=stack&safe=1&lens=deals',
  '?view=stack&safe=1&lens=expiry',
  '?view=stack&safe=1&select=L13-U1',
  '?view=stack&safe=1&select=A02',
  '?view=stack&safe=1&select=F2-gap',
  '?view=stack&safe=1&select=L18-U1',
  '?view=stack&safe=1&select=L06-U1',
  '?view=stack&safe=1&select=L04-U1',
  '?view=stack&safe=1&lens=rent&select=A02',
  '?view=stack&safe=1&floor=F6',
  '?view=stack&safe=1&req=12000',
  '?view=stack&safe=1&inquiry=I02',
  '?view=stack&safe=1&window=12',
  '?view=stack&safe=1&window=risk',
  '?view=stack&safe=1&mode=issues',
  '?view=stack&safe=1&q=anadarko',
  '?view=stack&safe=1&asOf=2028-01-01',
  '?view=timeline&safe=1',
  '?view=floor&floor=F6&safe=1',
  '?view=floor&floor=F2&safe=1',
  '?view=map&safe=1&mode=area',
  '?view=stack&safe=1&print=1',
];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
let leaks = 0;
for (const qs of states) {
  await page.goto(base + qs, { waitUntil: 'networkidle' });
  await page.waitForTimeout(qs.includes('map') ? 1500 : 250);
  const text = await page.evaluate(() => {
    const parts = [document.title, document.body.innerText];
    document.querySelectorAll('[aria-label]').forEach((el) => parts.push(el.getAttribute('aria-label') ?? ''));
    document.querySelectorAll('[title]').forEach((el) => parts.push(el.getAttribute('title') ?? ''));
    document.querySelectorAll('svg title, .sp-print').forEach((el) => parts.push(el.textContent ?? ''));
    return parts.join('\n');
  });
  const found = [...names].filter((n) => text.includes(n));
  for (const w of ['Holdover', 'MTM', 'Month-to-month', 'LOI', 'Proposal', 'Lease Out']) if (new RegExp(`\\b${w}\\b`).test(text)) found.push(`risk/deal word "${w}"`);
  if (/\bTour\b/.test(text.replace(/Schedule tour|Tour scheduled/g, ''))) found.push('deal word "Tour"');
  const riskGeom = await page.evaluate(() => document.querySelectorAll('.sp-tl-bar__ext--risk, .sp-tl-tag--risk').length);
  if (riskGeom) found.push(`risk geometry (${riskGeom})`);
  const rent = inPlaceRent.exec(text);
  if (found.length || rent) {
    leaks += found.length + (rent ? 1 : 0);
    console.log(`LEAK ${qs}: ${found.join(', ')}${rent ? ` rent "${rent[0]}"` : ''}`);
  } else console.log(`ok   ${qs}`);
  // Search must not confirm a tenant by highlighting
  if (qs.includes('q=anadarko')) {
    const [dimmed, total] = await page.evaluate(() => [document.querySelectorAll('.sp-seg.is-dim').length, document.querySelectorAll('.sp-seg').length]);
    if (dimmed > 0 && dimmed < total) {
      leaks++;
      console.log(`LEAK ${qs}: search highlighted ${total - dimmed} block(s) for a tenant name in prospect-safe mode`);
    }
  }
}
await browser.close();
if (leaks) {
  console.error(`\n${leaks} leak(s)`);
  process.exit(1);
}
console.log('\n0 leaks');
