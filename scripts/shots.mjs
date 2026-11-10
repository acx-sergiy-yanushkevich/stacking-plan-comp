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
  ['19-map-expiry', '?view=map&lens=expiry'],
  ['20-map-area', '?view=map&mode=area'],
  ['21-floor-6', '?view=floor&floor=F6'],
  ['22-floor-1', '?view=floor&floor=F1'],
  ['29-block-multifloor', '?view=stack&select=L17-U1'],
  ['30-floor-summary', '?view=stack&floor=F8'],
  ['31-prospect-safe-block', '?view=stack&safe=1&select=L13-U1'],
  ['32-timeline-safe', '?view=timeline&safe=1'],
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
]) {
  await mobile.goto(base + qs, { waitUntil: 'networkidle' });
  await mobile.waitForTimeout(qs.includes('view=map') ? 2500 : 350);
  // A selected block opens the bottom sheet: capture the viewport a phone user sees, not the full page.
  await mobile.screenshot({ path: `${out}/${name}.png`, fullPage: !qs.includes('view=map') && !qs.includes('select=') });
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
]) {
  await dark.setViewportSize({ width: w, height: 1100 });
  await dark.goto(base + qs, { waitUntil: 'networkidle' });
  await dark.waitForTimeout(qs.includes('view=map') ? 2500 : 350);
  await dark.screenshot({ path: `${out}/${name}.png`, fullPage: !qs.includes('view=map') });
}
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
