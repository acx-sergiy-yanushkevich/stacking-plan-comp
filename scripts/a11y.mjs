// Runs axe-core on the main views and inspector modes; fails on serious/critical violations.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

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
];
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
const page = await context.newPage();
let failed = 0;
for (const qs of states) {
  await page.goto(base + qs + extra, { waitUntil: 'networkidle' });
  await page.waitForTimeout(qs.includes('map') ? 2000 : 300);
  const results = await new AxeBuilder({ page }).disableRules(['region']).exclude('.maplibregl-map').analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const minor = results.violations.filter((v) => v.impact !== 'serious' && v.impact !== 'critical');
  console.log(`${qs}: ${serious.length} serious/critical, ${minor.length} minor`);
  for (const v of results.violations) {
    console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes) e.g. ${v.nodes[0]?.target?.join(' ')}`);
  }
  failed += serious.length;
}
await browser.close();
if (failed) {
  console.error(`\n${failed} serious/critical accessibility violations`);
  process.exit(1);
}
console.log('\nno serious or critical accessibility violations');
