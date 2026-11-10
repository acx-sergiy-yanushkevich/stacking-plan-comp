// Prospect-safe leak check: with safe=1, no tenant, contact, broker or prospect name, no in-place
// rent, no deal, inquiry, tenant-risk or data-issue wording, no record action and no quiet
// (unpublished) listing may appear anywhere in the DOM text, title, aria-labels or SVG <title>s.
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
// Where an inquiry came from (LoopNet, Crexi, a referral) is only ever shown with the inquiry itself.
const sources = new Set([...src.matchAll(/source: '([^']+)'/g)].map((m) => m[1]));
// Quiet listings: an availability that is not published must not be advertised to a prospect. The
// plan badges an occupied suite marketed for later "Avail Apr '27"; build that badge for each one.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const quietBadges = new Set();
for (const m of src.matchAll(/avail\(\{[^}]*?availableFrom: '(\d{4})-(\d{2})-\d{2}'[^}]*?published: false/g)) quietBadges.add(`Avail ${MONTHS[Number(m[2]) - 1]} '${m[1].slice(2)}`);
// In-place lease rates render as a single value "$29/SF/yr FSG"; asking rents are ranges "$31–$33/SF/yr".
const inPlaceRent = /(?<![–-])\$\d[\d.,]*\/SF\/(yr|mo)\s(FSG|MG|NNN)/;

const states = [
  '?view=building&safe=1',
  '?view=building&safe=1&floor=F6',
  '?view=building&safe=1&floor=F3',
  '?view=building&safe=1&floor=F2',
  '?view=building&safe=1&q=cirrus',
  '?view=stack&safe=1&q=cirrus',
  '?view=stack&safe=1',
  '?view=stack&safe=1&lens=rent',
  '?view=stack&safe=1&lens=deals',
  '?view=stack&safe=1&lens=expiry',
  '?view=stack&safe=1&select=L13-U1',
  '?view=building&safe=1&select=L13-U1',
  '?view=timeline&safe=1&select=L13-U1',
  '?view=floor&floor=F6&safe=1&select=L13-U1',
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
  '?view=floor&floor=F3&safe=1',
  '?view=floor&floor=F7&safe=1',
  '?view=map&safe=1&mode=area',
  '?view=stack&safe=1&print=1',
];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
let leaks = 0;
for (const qs of states) {
  await page.goto(base + qs, { waitUntil: 'networkidle' });
  await page.waitForTimeout(qs.includes('map') ? 1500 : 250);
  const grab = () =>
    page.evaluate(() => {
      const parts = [document.title, document.body.innerText];
      document.querySelectorAll('[aria-label]').forEach((el) => parts.push(el.getAttribute('aria-label') ?? ''));
      document.querySelectorAll('[title]').forEach((el) => parts.push(el.getAttribute('title') ?? ''));
      document.querySelectorAll('svg title, .sp-print').forEach((el) => parts.push(el.textContent ?? ''));
      // Dates are set with a non-breaking space ("Apr\u00a0'27"): compare on plain spaces.
      return parts.join('\n').replace(/\u00a0/g, ' ');
    });
  let text = await grab();
  // Lists behind tabs render only once their tab is chosen: open every tab and check what it shows.
  const tabs = page.locator('.sp-flists__tabs [role="radio"]');
  for (let i = 0; i < (await tabs.count()); i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(80);
    text += '\n' + (await grab());
  }
  const found = [...names].filter((n) => text.includes(n));
  // A search term may be a tenant name: in safe mode the query itself is never echoed back.
  const q = new URLSearchParams(qs).get('q');
  if (q && text.toLowerCase().includes(q.toLowerCase())) found.push(`search query "${q}" echoed`);
  for (const w of ['Holdover', 'MTM', 'Month-to-month', 'LOI', 'Proposal', 'Lease Out', 'term withheld', 'Term withheld']) if (new RegExp(`\\b${w}\\b`).test(text)) found.push(`risk/deal word "${w}"`);
  if (/\bTour\b/.test(text.replace(/Schedule tour|Tour scheduled/g, ''))) found.push('deal word "Tour"');
  for (const w of sources) if (new RegExp(`\\b${w}\\b`).test(text)) found.push(`inquiry source "${w}"`);
  for (const w of ['in holdover', 'month-to-month', 'Data gap', 'unaccounted', 'Over-allocated by', 'Inquiries that fit', 'Match an open inquiry']) if (text.toLowerCase().includes(w.toLowerCase())) found.push(`issue/inquiry wording "${w}"`);
  for (const w of ['Open record', 'New deal', 'Log call', 'Log a call', 'Create availability', 'Start renewal', 'Open lease']) if (text.includes(w)) found.push(`record action "${w}"`);
  // A quiet listing: its badge, its inspector section, its worklist chip and the listing status itself.
  for (const w of [...quietBadges, 'Marketed for later', 'Marketed from', 'marketed from', 'Quiet', 'not published']) if (new RegExp(`\\b${w}`).test(text)) found.push(`quiet listing "${w}"`);
  if (quietBadges.size && /Occupied, marketed for later/.test(text) && !/Occupied, marketed for later\s*(Nothing marketed ahead|—)/.test(text)) found.push('quiet listing counted in Coming supply');
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
