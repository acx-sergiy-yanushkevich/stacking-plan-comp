// Prospect-safe leak check: with safe=1, no tenant, contact, broker or prospect name, no in-place
// rent, no deal, inquiry, tenant-risk or data-issue wording, no record action, no quiet (unpublished)
// listing and no lease term may appear anywhere: DOM text, live regions, toasts, titles, aria-labels,
// SVG <title>s, the values of inputs, or the URL.
//
// Two kinds of state are checked. Fresh loads: a link opened with safe=1. Transitions: the app is
// loaded with the mode OFF, something that puts a name on screen is done (a block is selected, a deal
// record opened, a tenant searched, a tab opened, a block hovered), then the Prospect-safe switch is
// clicked and the same rules are applied at once, with no wait, and again after the app has settled.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:4180/';
// ONLY=timeline node scripts/leakcheck.mjs runs the cases whose label contains the text (for a quick re-check).
const only = process.env.ONLY ?? '';
const wanted = (label) => !only || label.toLowerCase().includes(only.toLowerCase());
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
  '?view=building&safe=1&lens=expiry&floor=F3',
  '?view=building&safe=1&lens=expiry',
  '?view=building&safe=1&q=cirrus',
  '?view=stack&safe=1&q=cirrus',
  '?view=timeline&safe=1&q=cirrus',
  '?safe=1&q=cirrus',
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
  '?view=stack&safe=1&lens=expiry&select=L06-U1',
  '?view=stack&safe=1&select=L04-U1',
  '?view=stack&safe=1&lens=expiry&select=L04-U1',
  '?view=stack&safe=1&lens=rent&select=A02',
  '?view=stack&safe=1&floor=F6',
  '?view=stack&safe=1&floor=F3',
  '?view=stack&safe=1&req=12000',
  '?view=stack&safe=1&inquiry=I02',
  '?view=stack&safe=1&window=12',
  '?view=stack&safe=1&window=risk',
  '?view=stack&safe=1&mode=worklist&window=24',
  '?view=stack&safe=1&bucket=0',
  '?view=stack&safe=1&mode=issues',
  '?view=stack&safe=1&q=anadarko',
  '?view=stack&safe=1&asOf=2028-01-01',
  '?view=stack&safe=1&asOf=2028-01-01&lens=expiry',
  '?view=timeline&safe=1',
  '?view=timeline&safe=1&lens=expiry',
  '?view=floor&floor=F6&safe=1',
  '?view=floor&floor=F2&safe=1',
  '?view=floor&floor=F2&safe=1&lens=expiry',
  '?view=floor&floor=F3&safe=1',
  '?view=floor&floor=F7&safe=1',
  '?view=map&safe=1&mode=area',
  '?view=map&safe=1&lens=expiry',
  '?view=stack&safe=1&print=1',
  '?view=stack&safe=1&lens=expiry&print=1',
];

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', acceptDownloads: true });
const page = await context.newPage();
let leaks = 0;

/** Everything a person or a screen reader could be given, as one string. */
const grab = () =>
  page.evaluate(() => {
    const parts = [document.title, location.search, document.body.innerText];
    document.querySelectorAll('[aria-label]').forEach((el) => parts.push(el.getAttribute('aria-label') ?? ''));
    document.querySelectorAll('[title]').forEach((el) => parts.push(el.getAttribute('title') ?? ''));
    document.querySelectorAll('svg title, .sp-print').forEach((el) => parts.push(el.textContent ?? ''));
    // Live regions and toasts are read by their text, whether or not they are painted.
    document.querySelectorAll('[role="status"], [role="alert"], [aria-live], .sp-toasts, .sp-toast').forEach((el) => parts.push(el.textContent ?? ''));
    // What is typed into a field is on screen too.
    document.querySelectorAll('input, textarea').forEach((el) => parts.push(el.value ?? '', el.getAttribute('placeholder') ?? ''));
    document.querySelectorAll('select').forEach((el) => parts.push(el.selectedOptions[0]?.textContent ?? ''));
    // Dates are set with a non-breaking space ("Apr\u00a0'27"): compare on plain spaces.
    return parts.join('\n').replace(/\u00a0/g, ' ');
  });

/**
 * Lease blocks and timeline bars, each as a signature: its accessible name and tooltip with the
 * suite's own identity (floor, suite number, SF, dates) taken out, plus its fill colour. Used to
 * prove that a holdover or month-to-month lease looks and reads exactly like an ordinary one.
 */
const signatures = (keys) =>
  page.evaluate((keys) => {
    const norm = (t) =>
      (t ?? '')
        .replace(/\u00a0/g, ' ')
        .replace(/Floor \d+/g, 'FLOOR')
        .replace(/\b(Ste|[Ss]uite) \d+/g, 'SUITE')
        .replace(/\d[\d,]* (R?SF)/g, 'N $1')
        .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, \d{4}/g, 'DATE')
        .replace(/\s+/g, ' ')
        .trim();
    const out = {};
    for (const key of keys) {
      const els = [...document.querySelectorAll(`[data-key="${key}"], [data-bar="tl-${key}"]`)];
      out[key] = els.map((el) => {
        const fill = el.querySelector('.sp-seg__rect, rect, path');
        // A timeline bar's fill is a fade gradient with an id of its own: every one is the same fade.
        const paint = fill ? getComputedStyle(fill).fill.replace(/url\("#sp-tl-fade-[^"]*"\)/, 'url(fade)') : '';
        return [el.tagName, norm(el.getAttribute('aria-label')), norm(el.querySelector(':scope > title')?.textContent), paint].join(' ¦ ');
      });
    }
    return out;
  }, keys);

/** The leak rules, applied to one grabbed text. Returns what was found. */
function findLeaks(text, { q } = {}) {
  const found = [...names].filter((n) => text.includes(n));
  // A search term may be a tenant name: in safe mode the query itself is never echoed back, in the
  // filter bar, the search box or the URL.
  if (q && text.toLowerCase().includes(q.toLowerCase())) found.push(`search query "${q}" echoed`);
  for (const w of ['Holdover', 'MTM', 'Month-to-month', 'LOI', 'Proposal', 'Lease Out', 'term withheld', 'Term withheld']) if (new RegExp(`\\b${w}\\b`).test(text)) found.push(`risk/deal word "${w}"`);
  if (/\bTour\b/.test(text.replace(/Schedule tour|Tour scheduled/g, ''))) found.push('deal word "Tour"');
  for (const w of sources) if (new RegExp(`\\b${w}\\b`).test(text)) found.push(`inquiry source "${w}"`);
  for (const w of ['in holdover', 'month-to-month', 'Data gap', 'unaccounted', 'Over-allocated by', 'Inquiries that fit', 'Match an open inquiry']) if (text.toLowerCase().includes(w.toLowerCase())) found.push(`issue/inquiry wording "${w}"`);
  for (const w of ['Open record', 'New deal', 'Log call', 'Log a call', 'Create availability', 'Start renewal', 'Open lease', 'Would open', 'Would create']) if (text.includes(w)) found.push(`record action "${w}"`);
  // A quiet listing: its badge, its inspector section, its worklist chip and the listing status itself.
  for (const w of [...quietBadges, 'Marketed for later', 'Marketed from', 'marketed from', 'Quiet', 'not published']) if (new RegExp(`\\b${w}`).test(text)) found.push(`quiet listing "${w}"`);
  if (quietBadges.size && /Occupied, marketed for later/.test(text) && !/Occupied, marketed for later\s*(Nothing marketed ahead|—)/.test(text)) found.push('quiet listing counted in Coming supply');
  // Lease terms: no lease in place says when it ends, and none is singled out as the one that does not.
  const term = /\bExp(ires|ired)? (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|\bTerm not disclosed|\bNext expiry|\bLease expirations|\bRenewal worklist|\bEnds (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.exec(text);
  if (term) found.push(`lease term "${term[0]}"`);
  const rent = inPlaceRent.exec(text);
  if (rent) found.push(`rent "${rent[0]}"`);
  return found;
}

/** Rules that need the DOM, not its text. */
async function findDomLeaks() {
  const found = [];
  const riskGeom = await page.evaluate(() => document.querySelectorAll('.sp-tl-bar__ext--risk, .sp-tl-tag--risk').length);
  if (riskGeom) found.push(`risk geometry (${riskGeom})`);
  // An at-risk lease must be indistinguishable from an ordinary one: same words, same tooltip, same colour.
  const sig = await signatures([...riskKeys, ...ordinaryKeys]);
  const ordinary = new Set(ordinaryKeys.flatMap((k) => sig[k] ?? []));
  if (ordinary.size) {
    for (const k of riskKeys) for (const s of sig[k] ?? []) if (!ordinary.has(s)) found.push(`at-risk lease ${k} reads unlike any ordinary lease: ${s}`);
    // "term not disclosed" (the timeline's wording) is only acceptable on every lease or on none.
    // (A lease that has ended by a projected as-of date is no longer a lease in place: it is vacated space, and is left out.)
    // A lease is drawn more than once (its bar, its block in the hidden print layout): it counts as said if any of them says it.
    const inPlace = [...riskKeys, ...ordinaryKeys].map((k) => (sig[k] ?? []).filter((s) => !/vacat|Projected vacancy/i.test(s))).filter((ss) => ss.length);
    const said = inPlace.map((ss) => ss.some((s) => /not disclosed/i.test(s)));
    if (said.some(Boolean) && !said.every(Boolean)) found.push('"not disclosed" on some leases and not others');
  }
  return found;
}

const report = (label, found) => {
  if (found.length) {
    leaks += found.length;
    console.log(`LEAK ${label}: ${[...new Set(found)].join(', ')}`);
  } else console.log(`ok   ${label}`);
};

// Which leases are at risk and which are ordinary, read from the broker's own view once.
await page.goto(base + '?view=stack', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const kinds = await page.evaluate(() => [...document.querySelectorAll('.sp-stack [data-key]')].map((el) => [el.getAttribute('data-key'), el.getAttribute('aria-label') ?? '']));
const riskKeys = kinds.filter(([, a]) => /Holdover|MTM|Month-to-month/.test(a)).map(([k]) => k);
const ordinaryKeys = kinds.filter(([, a]) => /\bExp [A-Z]/.test(a) && !/Holdover|MTM|Month-to-month|sublease/i.test(a)).map(([k]) => k);
if (riskKeys.length < 2 || ordinaryKeys.length < 5) {
  console.error(`Could not tell at-risk from ordinary leases in the broker view (${riskKeys.length} at risk, ${ordinaryKeys.length} ordinary): the check would prove nothing.`);
  process.exit(2);
}

// ── Fresh loads ────────────────────────────────────────────────────────────────────────────────
for (const qs of states) {
  if (!wanted(qs)) continue;
  await page.goto(base + qs, { waitUntil: 'networkidle' });
  await page.waitForTimeout(qs.includes('map') ? 1500 : 250);
  let text = await grab();
  const found = await findDomLeaks();
  // Lists behind tabs render only once their tab is chosen: open every tab and check what it shows.
  const tabs = page.locator('.sp-flists__tabs [role="radio"]');
  for (let i = 0; i < (await tabs.count()); i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(80);
    text += '\n' + (await grab());
  }
  found.push(...findLeaks(text, { q: new URLSearchParams(qs).get('q') }));
  // Search must not confirm a tenant by highlighting
  if (qs.includes('q=anadarko')) {
    const [dimmed, total] = await page.evaluate(() => [document.querySelectorAll('.sp-seg.is-dim').length, document.querySelectorAll('.sp-seg').length]);
    if (dimmed > 0 && dimmed < total) found.push(`search highlighted ${total - dimmed} block(s) for a tenant name in prospect-safe mode`);
  }
  report(qs, found);
}

// ── Transitions: the mode is turned on while something named is on screen ──────────────────────
const safeSwitch = () => page.getByRole('switch', { name: 'Prospect-safe' });
const block = (key) => page.locator(`.sp-stage [data-key="${key}"], .sp-stage [data-bar="tl-${key}"]`).first();
const tab = (name) => page.locator('.sp-flists__tabs [role="radio"]', { hasText: name }).first();
const search = () => page.locator('.sp-toolbar__search input').first();

const transitions = [
  ['select Cirrus Energy in the Stack', '?view=stack', async () => { await block('L13-U1').click(); }, 'Cirrus Energy'],
  ['select the holdover tenant in the Stack', '?view=stack', async () => { await block('L06-U1').click(); }, 'Argosy Partners'],
  ['select Cirrus Energy in the Timeline', '?view=timeline', async () => { await block('L13-U1').click(); }, 'Cirrus Energy'],
  ['select Cirrus Energy on the Building view', '?view=building&floor=F6', async () => { await block('L13-U1').click(); }, 'Cirrus Energy'],
  ['select Cirrus Energy on the Floor plate', '?view=floor&floor=F6', async () => { await block('L13-U1').click(); }, 'Cirrus Energy'],
  ['select a block by keyboard (Enter) in the Stack', '?view=stack', async () => { await block('L13-U1').focus(); await page.keyboard.press('Enter'); }, 'Cirrus Energy'],
  ['open the Vantage Robotics deal record (Building, Floor 6, Deals)', '?view=building&floor=F6', async () => { await tab('Deals').click(); await page.getByRole('button', { name: /^Open record: Vantage Robotics deal/ }).first().click(); }, 'Vantage Robotics'],
  ['open an inquiry record (Floor view, Floor 8, Inquiries)', '?view=floor&floor=F8', async () => { await tab('Inquiries').click(); await page.getByRole('button', { name: /^Open record: .* inquiry/ }).first().click(); }, 'Would open'],
  ['log a call from the floor actions (Floor 3)', '?view=floor&floor=F3', async () => { await page.getByRole('button', { name: /^Log call with/ }).click(); }, 'Argosy Partners'],
  ['run a lease action from the inspector (Open lease)', '?view=stack&select=L13-U1', async () => { await page.getByRole('button', { name: /^Open lease/ }).first().click(); }, 'Would open'],
  ['search for a tenant name ("cirrus")', '?view=stack', async () => { await search().fill('cirrus'); }, 'cirrus'],
  ['search for a prospect name ("vantage") on the Building view', '?view=building', async () => { await search().fill('vantage'); }, 'vantage'],
  ['search for a tenant name in the Timeline ("anadarko")', '?view=timeline', async () => { await search().fill('anadarko'); }, 'anadarko'],
  ...['Suites', 'Deals', 'Inquiries', 'Issues'].flatMap((name) => [
    [`open the ${name} tab (Building, Floor 8)`, '?view=building&floor=F8', async () => { await tab(name).click(); }, null],
    [`open the ${name} tab (Floor view, Floor 3)`, '?view=floor&floor=F3', async () => { await tab(name).click(); }, null],
  ]),
  ['hover a named block for its tooltip (Stack)', '?view=stack', async () => { await block('L13-U1').hover(); await page.waitForTimeout(700); }, 'Cirrus Energy'],
  ['hover a named bar for its tooltip (Timeline)', '?view=timeline', async () => { await block('L13-U1').hover(); await page.waitForTimeout(700); }, 'Cirrus Energy'],
  ['hover a named slice (Floor plate)', '?view=floor&floor=F6', async () => { await block('L13-U1').hover(); await page.waitForTimeout(700); }, 'Cirrus Energy'],
  ['open the renewal worklist', '?view=stack&mode=worklist&window=12', async () => {}, 'Cirrus Energy'],
  ['open the at-risk worklist', '?view=stack&mode=worklist&window=risk', async () => {}, 'Argosy Partners'],
  ['highlight a rollover period', '?view=stack&bucket=0', async () => {}, 'Cirrus Energy'],
  ['open the data issues panel', '?view=stack&mode=issues', async () => {}, null],
  ['match an open inquiry', '?view=stack&inquiry=I02', async () => {}, null],
  ['the deals lens with a suite selected', '?view=stack&lens=deals&select=A02', async () => {}, null],
  ['the expiration lens in the Timeline, projected to 2028', '?view=timeline&lens=expiry&asOf=2028-01-01', async () => {}, null],
];

for (const [name, qs, act, mustShowFirst] of transitions) {
  const label = `→ safe: ${name}`;
  if (!wanted(label)) continue;
  await page.goto(base + qs, { waitUntil: 'networkidle' });
  await page.waitForTimeout(qs.includes('map') ? 1500 : 250);
  try {
    await act();
  } catch (e) {
    leaks++;
    console.log(`FAIL ${label}: could not perform the action (${String(e.message).split('\n')[0]})`);
    continue;
  }
  await page.waitForTimeout(150);
  // The case only proves something if the name really was on screen before the switch.
  const before = await grab();
  if (mustShowFirst && !before.toLowerCase().includes(mustShowFirst.toLowerCase())) {
    leaks++;
    console.log(`FAIL ${label}: "${mustShowFirst}" was not on screen before the switch, so the case proves nothing`);
    continue;
  }
  // Keep the pointer where it is (a hover case must still be hovering): the switch is pressed by keyboard.
  await safeSwitch().focus();
  await page.keyboard.press('Enter');
  // At once: no wait between the switch and the first reading. Then again when everything has settled.
  const atOnce = await grab();
  const found = [...findLeaks(atOnce, { q: /search for/.test(name) ? mustShowFirst : null }).map((f) => `${f} (at once)`), ...(await findDomLeaks())];
  await page.waitForTimeout(700);
  let settled = await grab();
  const tabs = page.locator('.sp-flists__tabs [role="radio"]');
  for (let i = 0; i < (await tabs.count()); i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(80);
    settled += '\n' + (await grab());
  }
  found.push(...findLeaks(settled, { q: /search for/.test(name) ? mustShowFirst : null }), ...(await findDomLeaks()));
  if (!(await page.evaluate(() => new URLSearchParams(location.search).get('safe') === '1'))) found.push('the mode did not turn on');
  report(label, found);
}

// ── The prospect-safe CSV export ───────────────────────────────────────────────────────────────
if (wanted('prospect-safe CSV export')) try {
  await page.goto(base + '?view=stack&safe=1', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Export' }).click();
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.getByRole('menuitem', { name: /Rent roll \(CSV\)/ }).click()]);
  const csv = readFileSync(await download.path(), 'utf8');
  const found = findLeaks(csv);
  const rows = csv.split(/\r?\n/).map((r) => r.split(','));
  const col = (h) => rows[0].indexOf(h);
  for (const r of rows.slice(1)) if (r[col('State')] === 'Leased' && (r[col('Expiration')] || r[col('Months remaining')] || r[col('Rate')])) found.push(`CSV: Ste ${r[col('Suite')]} shows a term or rent`);
  // Asking rents are marketing information: the sublet suite's must be in the file, as it is in the PDF.
  if (!rows.some((r) => r[col('State')] === 'Sublease' && /^\d+(\.\d+)?–\d+(\.\d+)?$/.test(r[col('Rate')] ?? ''))) found.push('CSV: the sublease asking rent is missing');
  report('prospect-safe CSV export', found);
} catch (e) {
  leaks++;
  console.log(`FAIL prospect-safe CSV export: ${String(e.message).split('\n')[0]}`);
}

await browser.close();
if (leaks) {
  console.error(`\n${leaks} leak(s)`);
  process.exit(1);
}
console.log('\n0 leaks');
