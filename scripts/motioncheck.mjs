// Motion (docs/DESIGN.md §3.5), checked in a browser with motion ON. Every other check runs with reduced
// motion, so that its screenshots repeat; this one is what proves the motion itself: a view arrives and
// then is at rest, what is dismissed leaves, the finder sweeps, a play through time steps the date and
// never a figure, and reduced motion turns all of it off.
import { chromium } from 'playwright';
import { open, quietFonts } from './loadPage.mjs';

const base = process.env.BASE ?? 'http://localhost:4180/';
const browser = await chromium.launch({ channel: 'chrome' });
const fails = [];
const check = (cond, msg) => (cond ? console.log('ok  ', msg) : (fails.push(msg), console.log('FAIL', msg)));
const errors = [];

async function newPage(reducedMotion) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, locale: 'en-US', reducedMotion });
  await quietFonts(context);
  const page = await context.newPage();
  // The web fonts are aborted on purpose (loadPage.mjs); the browser reports each as a failed resource.
  page.on('console', (m) => m.type() === 'error' && !/net::ERR_FAILED/.test(m.text()) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return page;
}

/** The two loops the spec allows (the recording pulse and the map's loading shimmer). */
const LOOPS = ['sp-rec-pulse', 'sp-skel-shimmer'];
/** What is animating now, loops aside: keyframe names, and `transition:<property>` for transitions. */
const running = (page) =>
  page.evaluate(
    (loops) =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running' || a.playState === 'pending')
        .map((a) => a.animationName ?? `transition:${a.transitionProperty ?? ''}`)
        .filter((n) => !loops.includes(n)),
    LOOPS,
  );
/** Two frames on: styles are applied and animations have started. */
const frames = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true)))));
/**
 * How many pixels differ between two screenshots, counted in `page` (a canvas each). A layer that has been
 * animated is put back a hair differently at an anti-aliased edge now and then: a pixel or two, never a shape.
 */
const pixelsApart = (page, a, b) =>
  page.evaluate(
    async ([a, b]) => {
      const data = async (png) => {
        const image = new Image();
        await new Promise((done) => ((image.onload = done), (image.src = `data:image/png;base64,${png}`)));
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, image.width, image.height).data;
      };
      const [da, db] = [await data(a), await data(b)];
      if (da.length !== db.length) return Infinity;
      let n = 0;
      for (let i = 0; i < da.length; i += 4) if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) n++;
      return n;
    },
    [a.toString('base64'), b.toString('base64')],
  );
/** Of 1,584,000 pixels: an edge's worth, far below the smallest thing an entrance could leave undone (a row, a label, a swatch). */
const EDGE_PIXELS = 24;
const asOfIn = (page) => new URL(page.url()).searchParams.get('asOf');

const live = await newPage('no-preference');
const still = await newPage('reduce');

// ── Views arrive, then rest ──────────────────────────────────────────────────────────────────────────────
// Each view is switched to from another, sampled two frames in (its entrance is running), and again after
// the longest any entrance may take. At rest it is the page that never moved.
const ENTRANCES = { Stack: 'sp-enter-rise', Timeline: 'sp-enter-wipe', Building: 'sp-enter-drop' };
await open(live, base + '?view=timeline');
await open(still, base + '?view=timeline');
for (const [view, keyframes] of Object.entries(ENTRANCES)) {
  await live.getByRole('radio', { name: view, exact: true }).click();
  await frames(live);
  const during = await running(live);
  check(during.includes(keyframes), `${view} arrives with ${keyframes} (${[...new Set(during)].join(', ') || 'nothing running'})`);
  await live.waitForTimeout(700);
  const after = await running(live);
  check(after.length === 0, `${view} is at rest 700 ms after it arrives${after.length ? ` (still running: ${[...new Set(after)].join(', ')})` : ''}`);

  await still.getByRole('radio', { name: view, exact: true }).click();
  await frames(still);
  const moved = await running(still);
  check(moved.length === 0, `${view}: nothing moves under reduced motion${moved.length ? ` (${[...new Set(moved)].join(', ')})` : ''}`);
  await still.waitForTimeout(700);
  // The pointer is parked on the same control in both pages, so hover is the same in both pictures.
  const [a, b] = await Promise.all([live.screenshot(), still.screenshot()]);
  const apart = await pixelsApart(still, a, b);
  check(apart <= EDGE_PIXELS, `${view} at rest is the page that never moved (${apart} of ${1440 * 1100} pixels differ)`);
}

// The side panel joins the plan with the Stack view (the Building view shows a floor itself).
await open(live, base + '?view=building');
await live.getByRole('radio', { name: 'Stack', exact: true }).click();
await frames(live);
check((await running(live)).includes('sp-panel-in'), 'the side panel slides in when it joins the plan');
await live.waitForTimeout(600);

// ── What is dismissed leaves ─────────────────────────────────────────────────────────────────────────────
for (const [page, name] of [[live, 'motion on'], [still, 'reduced motion']]) {
  await page.getByRole('button', { name: 'Export' }).click();
  await page.waitForTimeout(250);
  check((await page.locator('.sp-pop__panel[role="menu"]').count()) === 1, `${name}: the Export menu opens`);
  await page.keyboard.press('Escape');
  await frames(page);
  const leaving = await page.locator('.sp-pop__panel.is-leaving').count();
  const focusBack = await page.evaluate(() => document.activeElement?.textContent?.includes('Export') ?? false);
  check(focusBack, `${name}: focus is back on Export at once, before the menu has gone`);
  if (page === live) {
    check(leaving === 1 && (await running(page)).includes('sp-pop-out'), 'motion on: the closed menu fades out, inert');
    check((await page.locator('.sp-pop__panel.is-leaving[inert][aria-hidden="true"]').count()) === 1, 'motion on: the leaving menu is hidden from assistive technology and takes no input');
  } else check(leaving === 0 && (await page.locator('.sp-pop__panel').count()) === 0, 'reduced motion: the closed menu is gone at once');
  await page.waitForTimeout(250);
  check((await page.locator('.sp-pop__panel').count()) === 0, `${name}: the menu is out of the page 250 ms later`);
}

// ── The finder sweeps up the floors ──────────────────────────────────────────────────────────────────────
await open(live, base + '?view=stack&req=12000');
const delays = await live.evaluate(() => {
  const delayOf = (row) => parseFloat(getComputedStyle(row.querySelector('.sp-seg')).transitionDelay) * 1000;
  const rows = [...document.querySelectorAll('.sp-stage .sp-stack__row')];
  return { top: delayOf(rows[0]), ground: delayOf(rows[rows.length - 1]), dim: document.querySelectorAll('.sp-stage .sp-seg.is-dim').length };
});
check(delays.dim > 10 && delays.ground === 0 && delays.top > 100 && delays.top <= 180, `dimming sweeps from the ground floor (${delays.ground} ms) to the top (${Math.round(delays.top)} ms)`);

// ── Play through time ────────────────────────────────────────────────────────────────────────────────────
await open(live, base + '?view=stack');
await live.getByRole('button', { name: /^As of / }).click();
await live.getByRole('button', { name: 'Play 5 years' }).click();
await live.waitForTimeout(1700);
const twoSteps = asOfIn(live);
check(twoSteps === '2027-05-09', `after two steps the address holds the second quarter (${twoSteps})`);
check((await live.getByRole('button', { name: 'Pause' }).count()) === 1, 'while it plays the button says Pause');
// Sampled over the next step: suites crossfade, and no figure, change chip or cursor is ever part of it.
const moving = await live.evaluate(
  () =>
    new Promise((done) => {
      const seen = new Set();
      let figures = 0;
      const until = performance.now() + 900;
      const look = () => {
        for (const a of document.getAnimations()) {
          const el = a.effect?.target;
          if (!el) continue;
          seen.add(a.animationName ?? `transition:${a.transitionProperty}`);
          if (el.closest('.sp-kpi__figure, .sp-kpi__value, .sp-kpi__delta, .sp-cursor')) figures++;
        }
        if (performance.now() < until) requestAnimationFrame(look);
        else done({ seen: [...seen], figures });
      };
      look();
    }),
);
check(moving.seen.includes('transition:fill') && moving.figures === 0, `a step crossfades the suites and moves no figure (${moving.seen.join(', ')}; figures animated: ${moving.figures})`);
await live.getByRole('button', { name: 'Pause' }).click();
const paused = asOfIn(live);
await live.waitForTimeout(1000);
check(asOfIn(live) === paused && (await live.getByRole('button', { name: 'Play 5 years' }).count()) === 1, `Pause holds the date (${paused})`);
// The person's own change wins over the play.
await live.getByRole('button', { name: 'Play 5 years' }).click();
await live.waitForTimeout(300);
await live.getByRole('button', { name: '+12 mo' }).click();
await live.waitForTimeout(1000);
check(asOfIn(live) === '2027-11-09' && (await live.getByRole('button', { name: 'Play 5 years' }).count()) === 1, `choosing a date stops the play and keeps that date (${asOfIn(live)})`);
// The last step: it stops at the end by itself.
await open(live, base + '?view=stack&asOf=2031-08-09');
await live.getByRole('button', { name: /^Projected/ }).click();
await live.getByRole('button', { name: 'Play 5 years' }).click();
await live.waitForTimeout(1900);
check(asOfIn(live) === '2031-11-09' && (await live.getByRole('button', { name: 'Play 5 years' }).count()) === 1, `the play stops at five years out (${asOfIn(live)})`);
// Prospect-safe fixes the date to today: turning it on ends a play, and nothing of it reaches the address.
await open(live, base + '?view=stack');
await live.getByRole('button', { name: /^As of / }).click();
await live.getByRole('button', { name: 'Play 5 years' }).click();
await live.waitForTimeout(900);
await live.keyboard.press('Escape');
await live.getByRole('switch', { name: 'Prospect-safe' }).click();
await live.waitForTimeout(1600);
check(new URL(live.url()).search === '?view=stack&safe=1', `Prospect-safe ends the play and the date stays today (${new URL(live.url()).search})`);

// Reduced motion: nothing moves by itself. The same button takes one step for each press.
await open(still, base + '?view=stack');
await still.getByRole('button', { name: /^As of / }).click();
check((await still.getByRole('button', { name: 'Play 5 years' }).count()) === 0, 'reduced motion: no Play button');
await still.getByRole('button', { name: 'Step 3 months' }).click();
await still.waitForTimeout(1200);
check(asOfIn(still) === '2027-02-09', `reduced motion: one press is one step, and the date then stays (${asOfIn(still)})`);

await browser.close();
check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
if (fails.length) {
  console.error(`\n${fails.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
