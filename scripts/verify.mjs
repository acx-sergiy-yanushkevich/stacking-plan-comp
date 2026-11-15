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
check((await page.locator('.sp-kpi').count()) === 7, '7 KPI cards');
const leasingToday = await page.locator('.sp-kpi').first().innerText();

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
const leasing2028 = await page.locator('.sp-kpi').first().innerText();
check(leasing2028 !== leasingToday, 'as-of 2028 changes the Leasing KPI');
check((await page.locator('.sp-kpi__delta').count()) >= 3, 'delta chips shown when projected');
// Seven cards at a narrow desktop: no chip is pushed out of its card (review, Nov 12: two were cut at 1280).
for (const width of [1200, 1280, 1366, 1400, 1439, 1440, 1500]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(150);
  const cut = await page.evaluate(() =>
    [...document.querySelectorAll('.sp-kpi')].filter((card) => {
      const chip = card.querySelector('.sp-kpi__delta');
      const body = card.querySelector('.sp-kpi__body');
      return chip && body && chip.getBoundingClientRect().bottom > body.getBoundingClientRect().bottom + 1;
    }).map((card) => card.getAttribute('data-kpi')),
  );
  check(cut.length === 0, `every change chip is inside its card at ${width} px${cut.length ? ` (cut: ${cut.join(', ')})` : ''}`);
}
await page.setViewportSize({ width: 1440, height: 1100 });
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

// Turning the building model: a quarter turn each way, in the address, with every leader drawn to the turned model.
await page.goto(base + '?view=building', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const floorsShown = await page.locator('.sp-flabel').count();
const anchorsAt = () => page.locator('[data-anchor]').evaluateAll((els) => els.map((e) => e.getAttribute('style')).join('|'));
const anchorsBefore = await anchorsAt();
await page.getByRole('button', { name: 'Turn the building right' }).click();
await page.waitForTimeout(200);
// Building is the default view, so the address names only the turn.
const turnIn = () => new URL(page.url()).searchParams.get('turn');
check(turnIn() === '1', `Turn the building right is a quarter turn, in the address (${new URL(page.url()).search})`);
check((await anchorsAt()) !== anchorsBefore, 'the turned model puts its floors\' points somewhere new');
check(floorsShown > 0 && (await page.locator('.sp-fleader').count()) === floorsShown, `every label keeps a leader to the turned model (${await page.locator('.sp-fleader').count()} of ${floorsShown})`);
await page.getByRole('button', { name: 'Turn the building left' }).click();
await page.waitForTimeout(200);
check(turnIn() === null, `Turn the building left turns it back (${new URL(page.url()).search || 'no turn'})`);
check((await anchorsAt()) === anchorsBefore, 'turned back, the floors\' points are where they were');
await page.getByRole('button', { name: 'Turn the building left' }).click();
await page.waitForTimeout(200);
check(turnIn() === '3', `a left turn from the usual view is the last quarter (${new URL(page.url()).search})`);
await page.locator('.sp-flabel').first().click();
await page.waitForTimeout(200);
check((await page.getByRole('button', { name: /Turn the building/ }).count()) === 0, 'with a floor open the model faces front and the turn buttons are gone');

// NFR-12 (rounds 29 and 30): a row fitted to the window keeps its tenant's whole name, and the Rent lens and the
// asking rows keep their rate, in every lens, owner and prospect-safe, in all four buildings, at the laptop sizes.
// Blocks too small to hold the text at its smallest size are left out for a rate: under 130 px wide (a 43 px row of the 22-floor tower at 99 px). The unit tests measure text without a
// canvas; only the browser knows what Chrome fits.
// Round 31: no size exemption for a name (a 99 x 43 café and a stale-touch badge both lost theirs unseen), and the laptop
// sizes of 1280 x 720 and 1366 x 650. A block with no tenant says its state, which is the name here.
const STATE_NAMES = new Set(['No lease or listing', 'Not on the market', 'For sale']);
for (const [w, h] of [[1470, 830], [1440, 1000], [1366, 768], [1280, 720], [1366, 650], [1920, 1080], [1536, 864], [1600, 900], [1180, 800]]) {
  const fit = await browser.newPage({ viewport: { width: w, height: h }, locale: 'en-US', reducedMotion: 'reduce' });
  const lost = [];
  for (const bd of ['', '&building=P002', '&building=P005', '&building=P007'])
    for (const lens of ['status', 'rent', 'expiry', 'deals'])
      for (const safe of ['', '&safe=1']) {
        await fit.goto(`${base}?view=stack&lens=${lens}${safe}${bd}`, { waitUntil: 'networkidle' });
        await fit.waitForTimeout(200);
        const cells = await fit.$$eval('.sp-stage [role="gridcell"]', (els) =>
          els.map((e) => {
            const r = e.querySelector('.sp-seg__rect');
            return { title: e.querySelector('title')?.textContent ?? '', text: [...e.querySelectorAll('text')].map((x) => x.textContent).join(' '), w: Number(r?.getAttribute('width')), h: Number(r?.getAttribute('height')) };
          }),
        );
        const flat = (t) => t.replace(/\s+/g, ' ');
        for (const c of cells) {
          const name = c.title.split('\n')[0].split(' · ')[0];
          const at = `${name} ${c.w}x${c.h} (${bd || 'P001'} ${lens}${safe})`;
          if (c.h >= 40 && name && !STATE_NAMES.has(name) && !flat(c.text).includes(flat(name))) lost.push(`name: ${at}`);
          if (lens === 'rent' && c.h >= 40 && c.w >= 130 && name !== 'For sale' && /\$\d/.test(c.title.split('\n').slice(0, 3).join(' ')) && !/\$\d/.test(c.text)) lost.push(`rate: ${at}`);
        }
      }
  check(lost.length === 0, `${w}x${h}: every fitted block keeps its whole name, and the Rent lens its rate${lost.length ? ` (lost: ${[...new Set(lost)].slice(0, 8).join('; ')})` : ''}`);
  await fit.close();
}
// Round 30: a move to another view is a history entry, so Back returns to the view it left (rounds 28 and 29: every
// change replaced the entry and Back left the app).
{
  const nav = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await nav.goto(`${base}?view=stack`, { waitUntil: 'networkidle' });
  await nav.getByRole('radio', { name: /Timeline/ }).click();
  await nav.waitForTimeout(200);
  const onTimeline = new URL(nav.url()).searchParams.get('view') === 'timeline';
  await nav.goBack();
  await nav.waitForTimeout(300);
  check(onTimeline && new URL(nav.url()).searchParams.get('view') === 'stack', `Back from the Timeline returns to the Stack (${nav.url().replace(base, '')})`);
  await nav.close();
}
// Round 33: Escape from a worklist opened by the Building panel's Holdover row (a control that is gone by then) puts
// focus on the Worklist button, not on the page.
{
  const f = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await f.goto(`${base}?view=stack`, { waitUntil: 'networkidle' });
  const row = f.locator('.sp-ins button', { hasText: 'Holdover' }).first();
  await row.focus();
  await f.keyboard.press('Enter');
  await f.waitForTimeout(400);
  await f.keyboard.press('Escape');
  await f.waitForTimeout(400);
  const on = await f.evaluate(() => (document.activeElement?.textContent ?? '').trim());
  check(on === 'Worklist', `Escape from a worklist opened by the Holdover row returns focus to the Worklist button (${on})`);
  await f.close();
}
// Round 34: on a phone the four Color-by switches stand in one row, and no label runs out of its switch (round 33:
// "Expiration" ran 7 px into Pipeline at 320 px).
for (const w of [320, 360, 390]) {
  const ph = await browser.newPage({ viewport: { width: w, height: 800 }, reducedMotion: 'reduce' });
  await ph.goto(`${base}?view=stack`, { waitUntil: 'networkidle' });
  const spill = await ph.$$eval('.sp-kpis__group--lens .sp-kpi', (els) =>
    els.flatMap((e) => {
      const box = e.getBoundingClientRect();
      return [...e.querySelectorAll('.sp-kpi__label, .sp-kpi__figure')].filter((t) => { const r = document.createRange(); r.selectNodeContents(t); return r.getBoundingClientRect().right > box.right + 0.5; }).map((t) => t.textContent.trim());
    }),
  );
  check(spill.length === 0, `${w} px: every Color-by label and figure stays inside its switch${spill.length ? ` (${spill.join(', ')})` : ''}`);
  await ph.close();
}
await browser.close();
check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
if (fails.length) {
  console.error(`\n${fails.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
