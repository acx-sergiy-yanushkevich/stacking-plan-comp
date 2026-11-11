// Smoke checks against the preview build: structure, keyboard grid, time travel, no console errors.
import { chromium } from 'playwright';

const base = process.env.BASE ?? 'http://localhost:4180/';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const fails = [];
const check = (cond, msg) => (cond ? console.log('ok  ', msg) : (fails.push(msg), console.log('FAIL', msg)));

await page.goto(base + '?view=stack', { waitUntil: 'networkidle' });
check((await page.locator('.sp-stage [role="grid"] [role="row"]').count()) === 12, '12 floor rows');
const blocks = await page.locator('.sp-stage [role="gridcell"]').count();
check(blocks >= 28, `≥ 28 blocks (${blocks})`);
check((await page.locator('.sp-kpi').count()) === 6, '6 KPI cards');
const leasedToday = await page.locator('.sp-kpi').first().innerText();

// Keyboard grid: focus first block, ArrowRight moves to the next block in the row
await page.locator('.sp-stage [role="gridcell"][tabindex="0"]').first().focus();
const k1 = await page.evaluate(() => document.activeElement?.getAttribute('data-key'));
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(120);
const k2 = await page.evaluate(() => document.activeElement?.getAttribute('data-key'));
check(k1 && k2 && k1 !== k2, `ArrowRight moves focus (${k1} → ${k2})`);
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(120);
const k3 = await page.evaluate(() => document.activeElement?.getAttribute('data-key'));
check(k3 && k3 !== k2, `ArrowDown moves focus (${k2} → ${k3})`);
await page.keyboard.press('Enter');
await page.waitForTimeout(100);
check(page.url().includes('select='), 'Enter selects the block (URL has select=)');
check((await page.locator('.sp-stage .sp-seg.is-selected').count()) === 1, 'exactly one selected block');
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
check(!page.url().includes('select='), 'Escape clears the selection');

// Floor label opens the floor summary
await page.locator('.sp-stage [role="rowheader"]').first().click();
await page.waitForTimeout(100);
check(page.url().includes('floor=F12'), 'floor label opens floor summary');

// Time travel changes KPIs
await page.goto(base + '?view=stack&asOf=2028-01-01', { waitUntil: 'networkidle' });
const leased2028 = await page.locator('.sp-kpi').first().innerText();
check(leased2028 !== leasedToday, 'as-of 2028 changes the Leased KPI');
check((await page.locator('.sp-kpi__delta').count()) >= 3, 'delta chips shown when projected');
check((await page.locator('.sp-header__asof--projected').count()) === 1, 'header marks the date as projected');

// Filters dim
await page.goto(base + '?view=stack&req=12000', { waitUntil: 'networkidle' });
check((await page.locator('.sp-stage .sp-seg.is-dim').count()) > 10, 'finder dims non-matching blocks');
check((await page.locator('.sp-filterbar').count()) === 1, 'filter bar names the filter');

// Views render
for (const v of ['timeline', 'floor&floor=F6', 'map']) {
  await page.goto(base + `?view=${v}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(v === 'map' ? 2500 : 300);
  const ok = (await page.locator('.sp-stage').innerText()).length > 20;
  check(ok, `view ${v} renders`);
}

// Prospect-safe on and off: the header, the KPI bar and the toolbar are the same size in the same place,
// so turning the mode on or off moves nothing above the plan. Checked by the switch, on a desktop, a
// narrow desktop, a tablet and a phone. Turning it off also brings back what turning it on removed.
for (const [w, h] of [[1440, 1000], [1280, 900], [1100, 900], [1024, 768], [768, 1024], [390, 844]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(base + '?view=stack', { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  const bands = () =>
    page.evaluate(() => {
      const box = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.top * 10) / 10, Math.round(r.height * 10) / 10]; };
      return { header: box(document.querySelector('.sp-header')), kpis: box(document.querySelector('.sp-kpis')), toolbar: box(document.querySelector('.sp-toolbar')) };
    });
  const off = JSON.stringify(await bands());
  await page.getByRole('switch', { name: 'Prospect-safe' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  const on = JSON.stringify(await bands());
  check(page.url().includes('safe=1') && on === off, `${w} px: header, KPI bar and toolbar do not move when Prospect-safe is turned on${on === off ? '' : ` (off ${off}, on ${on})`}`);
}
await page.setViewportSize({ width: 1440, height: 1100 });
await page.goto(base + '?view=stack&lens=expiry&asOf=2028-06-01&mode=worklist&window=12', { waitUntil: 'networkidle' });
const before = new URL(page.url()).search;
await page.getByRole('switch', { name: 'Prospect-safe' }).click();
await page.waitForTimeout(150);
const during = new URL(page.url()).search;
check(during === '?view=stack&safe=1', `Prospect-safe on leaves nothing withheld in the URL (${during})`);
await page.getByRole('switch', { name: 'Prospect-safe' }).click();
await page.waitForTimeout(150);
check(new URL(page.url()).search === before, `Prospect-safe off restores the date, the lens and the worklist (${new URL(page.url()).search})`);
check((await page.locator('.sp-header__asof--projected').count()) === 1 && (await page.locator('.sp-kpi__delta').count()) >= 3, 'the restored plan is drawn for the restored date');

await browser.close();
check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
if (fails.length) {
  console.error(`\n${fails.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
