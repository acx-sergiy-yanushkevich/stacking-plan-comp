// Runs axe-core on the main views and inspector modes; fails on serious/critical violations.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { open, quietFonts } from './loadPage.mjs';

const base = process.env.BASE ?? 'http://localhost:4180/';
// Appended to every state, e.g. EXTRA='&theme=light' or EXTRA='&skin=aurora'.
const extra = process.env.EXTRA ?? '';
const states = [
  '?view=building',
  '?view=building&floor=F6',
  '?view=stack',
  '?view=stack&lens=expiry&select=L13-U1',
  '?view=stack&req=12000',
  // The space finder with a refused needed-by date (an alert under the field) and with nothing that fits.
  '?view=stack&req=5000&by=2026-09-11&mode=find',
  '?view=stack&req=1000&max=1200&mode=find',
  '?view=stack&window=12',
  '?view=stack&mode=issues',
  '?view=stack&safe=1',
  '?view=timeline',
  '?view=floor&floor=F6',
  '?view=map&mode=area',
  '?view=stack&mode=area',
  '?view=stack&mode=brief',
  '?view=stack&mode=brief&theme=light',
  // Every other building that opens, in the states that differ by building (round 23: only the default was checked).
  ...['P002', 'P005', 'P007'].flatMap((id) => [
    `?building=${id}&view=building`,
    `?building=${id}&view=stack&lens=expiry`,
    `?building=${id}&view=stack&mode=issues`,
    `?building=${id}&view=stack&safe=1`,
  ]),
  '?building=P002&view=stack&req=60000&mode=find',
  '?building=P005&view=stack&lens=deals',
  // A search that reads as a requirement: the bar's offer and Clear.
  '?view=stack&q=12k%20direct%20by%20jun%202027',
];
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
await quietFonts(context);
const page = await context.newPage();
let failed = 0;
for (const qs of states) {
  await open(page, base + qs + extra, qs.includes('map') ? 2000 : 300);
  const results = await new AxeBuilder({ page }).disableRules(['region']).exclude('.maplibregl-canvas').analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const minor = results.violations.filter((v) => v.impact !== 'serious' && v.impact !== 'critical');
  console.log(`${qs}: ${serious.length} serious/critical, ${minor.length} minor`);
  for (const v of results.violations) {
    console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes) e.g. ${v.nodes[0]?.target?.join(' ')}`);
  }
  failed += serious.length;
}
// A phone (390 px): the states that only a phone draws (row badges dimmed by a filter, the "Issues" button,
// the folded legend opened). Round 22 found two serious violations here that the desktop pass could not see.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
await quietFonts(phone);
const phonePage = await phone.newPage();
for (const qs of ['?view=stack', '?view=stack&window=12', '?view=stack&req=12000', '?view=timeline', '?view=map', '?view=stack&lens=expiry&legend=open', '?view=stack&q=12k%20direct%20by%20jun%202027', '?building=P002&view=stack', '?building=P005&view=stack&safe=1']) {
  await open(phonePage, base + qs.replace('&legend=open', '') + extra, qs.includes('map') ? 2000 : 300);
  if (qs.includes('legend=open')) await phonePage.locator('details summary').first().click();
  const results = await new AxeBuilder({ page: phonePage }).disableRules(['region']).exclude('.maplibregl-canvas').analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  console.log(`phone ${qs}: ${serious.length} serious/critical, ${results.violations.length - serious.length} minor`);
  for (const v of results.violations) console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes) e.g. ${v.nodes[0]?.target?.join(' ')}`);
  failed += serious.length;
}
await browser.close();
if (failed) {
  console.error(`\n${failed} serious/critical accessibility violations`);
  process.exit(1);
}
console.log('\nno serious or critical accessibility violations');
