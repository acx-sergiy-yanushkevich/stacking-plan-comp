// Renders every judged state to PNG. Usage: node scripts/shots.mjs <outDir>  (expects the preview on :4180, or BASE)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'docs/shots/latest';
const base = process.env.BASE ?? 'http://localhost:4180/';
mkdirSync(out, { recursive: true });

export const STATES = [
  ['33-building', '?view=building'],
  ['34-building-pinned', '?view=building&floor=F8'],
  ['35-building-find', '?view=building&req=12000'],
  ['38-building-suite', '?view=building&select=A02'],
  ['39-building-expiry', '?view=building&lens=expiry'],
  ['00-stack-status', '?view=stack'],
  ['01-stack-expiry', '?view=stack&lens=expiry'],
  ['02-stack-deals', '?view=stack&lens=deals'],
  ['03-stack-rent', '?view=stack&lens=rent'],
  ['04-block-cirrus-marketed', '?view=stack&select=L13-U1'],
  ['05-block-available-divisible', '?view=stack&select=A02'],
  ['06-issues', '?view=stack&mode=issues'],
  ['07-asof-2028', '?view=stack&asOf=2028-01-01'],
  ['08-find-12000', '?view=stack&req=12000'],
  ['09-rollover-bucket-1', '?view=stack&lens=expiry&bucket=1'],
  ['10-prospect-safe', '?view=stack&safe=1'],
  ['11-search-vantage', '?view=stack&q=vantage'],
  ['12-worklist-12mo', '?view=stack&lens=expiry&window=12'],
  ['13-unaccounted-floor2', '?view=stack&select=F2-gap'],
  ['14-inquiry-match', '?view=stack&inquiry=I02'],
  ['15-worklist-at-risk', '?view=stack&window=risk'],
  ['16-timeline', '?view=timeline'],
  ['17-timeline-2028-expiry', '?view=timeline&asOf=2028-01-01&lens=expiry'],
  ['18-map', '?view=map'],
  ['20-map-area', '?view=map&mode=area'],
  ['21-floor-6', '?view=floor&floor=F6'],
  ['22-floor-1', '?view=floor&floor=F1'],
  ['29-block-multifloor', '?view=stack&select=L17-U1'],
  ['30-floor-summary', '?view=stack&floor=F8'],
  ['31-prospect-safe-block', '?view=stack&safe=1&select=L13-U1'],
  ['32-timeline-safe', '?view=timeline&safe=1'],
  ['46-area-panel', '?view=stack&mode=area'],
  ['47-location-brief', '?view=stack&mode=brief'],
  ['49-floor-area', '?view=floor&floor=F6&mode=area'],
  // Round 23: a size typed in search, the prospect-safe Rent legend, a refused finder range, the other buildings.
  ['57-search-size', '?view=stack&q=12k%20direct%20by%20jun%202027'],
  ['58-safe-rent', '?view=stack&lens=rent&safe=1'],
  ['60-find-range', '?view=stack&mode=find&req=5000&max=3000'],
  ['61-legacy-west', '?view=building&building=P002'],
  ['62-cedar-springs', '?view=stack&building=P005'],
  ['63-bluebonnet-map', '?view=map&building=P007'],
  // Round 25: the Timeline says why its bars are dimmed, and the Map answers a size typed in search.
  ['66-timeline-search', '?view=timeline&q=vantage'],
  ['67-map-search-size', '?view=map&q=12k%20direct%20by%20jun%202027'],
  // Round 26: a Map link that carries a suite opens the Area panel (the suite waits for the plan).
  ['70-map-link-suite', '?view=map&select=L13-U1'],
];

const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
const hook = (page, name) => {
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
};
const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, locale: 'en-US', reducedMotion: 'reduce' });
hook(desktop, 'desktop');
for (const [name, qs] of STATES) {
  await desktop.goto(base + qs, { waitUntil: 'networkidle' });
  await desktop.waitForTimeout(qs.includes('view=map') ? 2500 : 350);
  await desktop.screenshot({ path: `${out}/${name}.png`, fullPage: !qs.includes('view=map') });
}
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US', isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
hook(mobile, 'mobile');
for (const [name, qs] of [
  ['23-mobile-stack', '?view=stack'],
  ['24-mobile-block', '?view=stack&select=A02'],
  ['25-mobile-timeline', '?view=timeline'],
  ['25b-mobile-map', '?view=map'],
  ['48-mobile-brief', '?view=stack&mode=brief'],
]) {
  await mobile.goto(base + qs, { waitUntil: 'networkidle' });
  await mobile.waitForTimeout(qs.includes('view=map') ? 2500 : 350);
  // A selected block opens the bottom sheet: capture the viewport a phone user sees, not the full page.
  await mobile.screenshot({ path: `${out}/${name}.png`, fullPage: !qs.includes('view=map') && !qs.includes('select=') && !qs.includes('mode=') });
}
const dark = await browser.newPage({ viewport: { width: 1440, height: 1100 }, colorScheme: 'dark', locale: 'en-US', reducedMotion: 'reduce' });
hook(dark, 'dark');
await dark.goto(base + '?view=stack&lens=expiry', { waitUntil: 'networkidle' });
await dark.waitForTimeout(350);
await dark.screenshot({ path: `${out}/26-dark-stack.png`, fullPage: true });
await dark.goto(base + '?view=map', { waitUntil: 'networkidle' });
await dark.waitForTimeout(2500);
await dark.screenshot({ path: `${out}/27-dark-map.png` });
// Daytime theme and the tablet layout of the Building view.
for (const [name, qs, w] of [
  ['36-light-building', '?view=building&theme=light', 1440],
  ['37-light-stack', '?view=stack&theme=light', 1440],
  ['40-light-building-pinned', '?view=building&floor=F3&theme=light', 1440],
  ['41-light-map', '?view=map&theme=light', 1440],
  ['42-tablet-building', '?view=building', 1024],
  ['43-tablet-building-pinned', '?view=building&floor=F8', 1024],
  ['44-vice-building', '?view=building&palette=vice', 1440],
  ['45-vice-stack', '?view=stack&palette=vice', 1440],
  ['52-issues', '?view=stack&mode=issues&theme=light', 1440],
  ['53-light-expiry', '?view=stack&lens=expiry&theme=light', 1440],
  ['50-light-header-safe', '?view=stack&safe=1&theme=light', 1440],
  ['51-tablet-floor-area', '?view=floor&floor=F6&mode=area&theme=light', 1024],
]) {
  await dark.setViewportSize({ width: w, height: 1100 });
  await dark.goto(base + qs, { waitUntil: 'networkidle' });
  await dark.waitForTimeout(qs.includes('view=map') ? 2500 : 350);
  await dark.screenshot({ path: `${out}/${name}.png`, fullPage: !qs.includes('view=map') });
}
// Round 22: the legend from the keyboard (an entry focused, its figures in a tooltip), the ⓘ note opened as a
// popover, and the phone's unfolded legend with each entry's figures.
await dark.setViewportSize({ width: 1440, height: 1100 });
await dark.goto(base + '?view=stack&lens=expiry', { waitUntil: 'networkidle' });
await dark.waitForTimeout(350);
await dark.locator('.sp-legend__item').first().focus();
await dark.waitForTimeout(150);
await dark.screenshot({ path: `${out}/54-legend-focus.png` });
await dark.locator('.sp-legend__info').first().click();
await dark.waitForTimeout(250);
await dark.screenshot({ path: `${out}/55-legend-note.png` });
// Round 24: the Map's surroundings, a place row of the Area panel lighting its pins, and the building in 3D.
await dark.goto(base + '?view=map', { waitUntil: 'load' });
await dark.waitForTimeout(3000);
await dark.locator('.sp-area__place', { hasText: 'Restaurants' }).first().focus();
await dark.waitForTimeout(300);
await dark.screenshot({ path: `${out}/59-map-places-lit.png` });
await dark.getByRole('button', { name: 'Show in 3D' }).click();
await dark.waitForTimeout(1500);
await dark.screenshot({ path: `${out}/64-map-3d.png` });
// Round 25: the ring chosen in the map's key (5 miles: the rail stations come into the frame), a kind of place
// in the key lighting its pins, and a rail station's row bringing the station into view with the building.
await dark.goto(base + '?view=map', { waitUntil: 'load' });
await dark.waitForTimeout(3000);
await dark.getByRole('radiogroup', { name: 'Ring around the building' }).getByRole('radio', { name: '5 mi' }).click();
await dark.waitForTimeout(1500);
await dark.screenshot({ path: `${out}/65-map-ring-5mi.png` });
await dark.goto(base + '?view=map', { waitUntil: 'load' });
await dark.waitForTimeout(3000);
await dark.locator('.sp-map-key__item--place', { hasText: 'Cafés' }).hover();
await dark.waitForTimeout(300);
await dark.screenshot({ path: `${out}/68-map-key-lit.png` });
await dark.mouse.move(0, 0);
await dark.locator('.sp-area__place', { hasText: 'Parker Road Station' }).first().focus();
await dark.waitForTimeout(1500);
await dark.screenshot({ path: `${out}/69-map-stop-lit.png` });
// Round 26: at five miles (`ring=5`) the places fold into the half-mile label's count, and a kind lit from the key
// comes back; a KPI detail reached from the keyboard lights its suites, as pointing at it does.
await dark.goto(base + '?view=map&ring=5', { waitUntil: 'load' });
await dark.waitForTimeout(3000);
await dark.locator('.sp-map-key__item--place', { hasText: 'Cafés' }).focus();
await dark.waitForTimeout(400);
await dark.screenshot({ path: `${out}/71-map-folded-lit.png` });
await dark.goto(base + '?view=stack', { waitUntil: 'networkidle' });
await dark.waitForTimeout(350);
await dark.locator('[data-kpi="find"]').focus();
await dark.waitForTimeout(400);
await dark.screenshot({ path: `${out}/72-kpi-focus.png` });
await mobile.goto(base + '?view=stack&lens=expiry', { waitUntil: 'networkidle' });
await mobile.waitForTimeout(350);
await mobile.locator('.sp-pstack__legend summary').click();
await mobile.waitForTimeout(250);
await mobile.screenshot({ path: `${out}/56-mobile-legend.png` });
const print = await browser.newPage({ viewport: { width: 1400, height: 1000 }, locale: 'en-US', reducedMotion: 'reduce' });
hook(print, 'print');
await print.goto(base + '?view=stack&print=1', { waitUntil: 'networkidle' });
await print.emulateMedia({ media: 'print' });
await print.waitForTimeout(350);
await print.screenshot({ path: `${out}/28-print.png`, fullPage: true });
await browser.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('wrote screenshots to', out);
