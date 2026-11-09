// One screenshot: node scripts/one.mjs "<query>" out.png [width] [height] [dark]
import { chromium } from 'playwright';

const [, , qs = '', out = '/tmp/shot.png', w = '1440', h = '1100', dark = ''] = process.argv;
const base = process.env.BASE ?? 'http://localhost:4180/';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1, locale: 'en-US', colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce' });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(base + qs, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
if (errors.length) console.log('console errors:\n' + errors.join('\n'));
console.log('wrote', out);
