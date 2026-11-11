// Prospect-safe leak check: with safe=1, no tenant, contact, broker or prospect name, no in-place
// rent, no deal, inquiry, tenant-risk or data-issue wording, no record action, no quiet (unpublished)
// listing, no date of any lease (start or end, in place or signed), no end date of a sublease (it is
// its sublandlord's lease end), no rollover by period, no expiring figure, no WALT figure, no inquiry
// (not its name, not its size range, not in the URL) and no lens that colours by something withheld
// may appear anywhere: DOM text, live regions, toasts, titles, aria-labels, SVG <title>s, the print
// layout, the values of inputs, or the URL.
//
// Three kinds of state are checked. Fresh loads: a link opened with safe=1. Time travel: every one of
// those links again with `asOf` set to later dates, which must give the same page as today's, to the
// character (a later date used to show each lease's end as a vacated suite, and to open a quiet
// listing). Transitions: the app is loaded with the mode OFF, something that puts a name on screen is
// done (a block is selected, a deal record opened, a tenant searched, a tab opened, a block hovered, the
// date moved), then the Prospect-safe switch is clicked and the same rules are applied at once, with no
// wait, and again after the app has settled. Last, the CSV export, today and for a later date.
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

// ── Lease dates ────────────────────────────────────────────────────────────────────────────────
// Every commencement, expiration and termination date in the mock, in each form the app writes a
// date: ISO (the CSV), "Sep 30, 2028", "Sep 2028" and "Sep '28". The end date of a sublease is one
// of them: a sublease ends with the lease it is cut from. A date that is also a date of the offer
// (available from) or of the page itself (today, a record's last change) is not a lease date to a
// reader, so it is left out; for the month forms, so is its whole month.
const TODAY = /export const TODAY[^=]*= '(\d{4}-\d{2}-\d{2})'/.exec(src)?.[1];
if (!TODAY) {
  console.error('Could not read TODAY from the mock data.');
  process.exit(2);
}
const isoDates = (re) => [...src.matchAll(re)].map((m) => m[1]);
const subleaseEnds = isoDates(/\bsubleaseExpiration: '(\d{4}-\d{2}-\d{2})'/g);
const leaseDateList = [...isoDates(/\b(?:commencement|expiration|termination): '(\d{4}-\d{2}-\d{2})'/g), ...subleaseEnds];
const publicDates = new Set([TODAY, ...isoDates(/\b(?:availableFrom|verifiedAt|dataUpdated|at|date|updated|neededBy|asOf): '(\d{4}-\d{2}-\d{2})'/g)]);
const long = (d) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}, ${d.slice(0, 4)}`;
const monthYear = (d) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const monthShort = (d) => `${MONTHS[Number(d.slice(5, 7)) - 1]} '${d.slice(2, 4)}`;
const publicMonths = new Set([...publicDates].map((d) => d.slice(0, 7)));
const leaseDates = new Set(leaseDateList.filter((d) => !publicDates.has(d)));
const leaseDateWords = new Map();
for (const d of leaseDates) {
  leaseDateWords.set(d, d);
  leaseDateWords.set(long(d), d);
  if (!publicMonths.has(d.slice(0, 7))) {
    leaseDateWords.set(monthYear(d), d);
    leaseDateWords.set(monthShort(d), d);
  }
}
if (leaseDates.size < 20) {
  console.error(`Only ${leaseDates.size} lease dates were read from the mock data: the check would prove little.`);
  process.exit(2);
}
// The sublease end must really be among the dates looked for, in every form: it is the case this list was extended for.
if (!subleaseEnds.length || !subleaseEnds.every((d) => leaseDates.has(d) && leaseDateWords.get(long(d)) === d && leaseDateWords.get(monthYear(d)) === d && leaseDateWords.get(monthShort(d)) === d)) {
  console.error('The sublease end date of the mock is not checked in every form (it collides with a public date): the check would prove nothing about it.');
  process.exit(2);
}

// ── Inquiries ──────────────────────────────────────────────────────────────────────────────────
// Each open inquiry: its id (it must not stay in the URL) and its size range as the app writes it
// ("15,000–22,000"), which is another prospect's requirement whether or not the name is beside it.
const inquiryList = [...src.matchAll(/\{ id: '(I\d+)', prospect: '[^']+', minSize: (\d+), maxSize: (\d+), neededBy: '(\d{4}-\d{2}-\d{2})'/g)].map((m) => ({ id: m[1], range: `${Number(m[2]).toLocaleString('en-US')}–${Number(m[3]).toLocaleString('en-US')}`, neededBy: m[4] }));
if (inquiryList.length < 3) {
  console.error(`Only ${inquiryList.length} inquiries were read from the mock data: the inquiry checks would prove little.`);
  process.exit(2);
}

// ── Quiet listings, whatever the suite's state ─────────────────────────────────────────────────
// Each unpublished availability: its record id (a block or bar drawn for it carries it as its key) and
// its asking range, when no published listing asks the same.
const availBlocks = [...src.matchAll(/avail\(\{([^}]*)\}/g)].map((m) => m[1]);
const field = (b, name) => new RegExp(`\\b${name}: '?([^,'\\s]+)'?`).exec(b)?.[1];
const askOf = (b) => `$${field(b, 'rentLow')}–$${field(b, 'rentHigh')}/SF/`;
const quiet = availBlocks.filter((b) => /published: false/.test(b));
const quietIds = quiet.map((b) => field(b, 'id'));
const publishedAsks = new Set(availBlocks.filter((b) => !/published: false/.test(b)).map(askOf));
const quietAsks = quiet.map(askOf).filter((a) => !publishedAsks.has(a));
if (!quietIds.length) {
  console.error('The mock data has no unpublished availability: the quiet-listing checks would prove nothing.');
  process.exit(2);
}

// Later as-of dates each safe link is loaded with, in months from today.
const AHEAD = [3, 6, 12, 24];
const addMonths = (d, n) => {
  const t = Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1 + n;
  const y = Math.floor(t / 12);
  const m = (t % 12) + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(Number(d.slice(8, 10)), last)).padStart(2, '0')}`;
};

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
  '?safe=1&inquiry=I02',
  '?view=stack&safe=1&inquiry=I02&mode=find',
  '?view=stack&safe=1&inquiry=I02&fit=direct&select=L13-U1',
  '?view=timeline&safe=1&inquiry=I01&mode=find',
  '?view=building&safe=1&floor=F8&inquiry=I04',
  '?view=stack&safe=1&select=L14-U2&lens=rent',
  '?view=timeline&safe=1&select=L14-U2',
  '?view=floor&floor=F7&safe=1&select=L14-U2',
  '?view=building&safe=1&floor=F7',
  '?view=stack&safe=1&req=5000&fit=sublease&mode=find',
  '?view=stack&safe=1&window=12',
  '?view=stack&safe=1&window=risk',
  '?view=stack&safe=1&mode=worklist&window=24',
  '?view=stack&safe=1&bucket=0',
  '?view=stack&safe=1&mode=issues',
  '?view=stack&safe=1&q=anadarko',
  '?view=stack&safe=1&asOf=2027-04-15',
  '?view=stack&safe=1&asOf=2028-01-01',
  '?view=stack&safe=1&asOf=2028-01-01&lens=expiry',
  '?view=timeline&safe=1&asOf=2028-01-01',
  '?view=stack&safe=1&select=L09-U1',
  '?view=timeline&safe=1&select=L09-U1',
  '?view=stack&safe=1&lens=expiry&select=L09-U1',
  '?view=stack&safe=1&select=L14-U2',
  '?view=stack&safe=1&select=A04',
  '?view=stack&safe=1&req=20000&by=2027-06-01',
  '?view=stack&safe=1&req=12000&fit=sublease&mode=find',
  '?view=building&safe=1&floor=F4',
  '?view=floor&floor=F4&safe=1',
  '?view=timeline&safe=1',
  '?view=timeline&safe=1&lens=expiry',
  '?view=floor&floor=F6&safe=1',
  '?view=floor&floor=F2&safe=1',
  '?view=floor&floor=F2&safe=1&lens=expiry',
  '?view=floor&floor=F3&safe=1',
  '?view=floor&floor=F7&safe=1',
  '?view=map&safe=1&mode=area',
  '?view=stack&safe=1&mode=brief',
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
  // No date of any lease, in any form the app writes one.
  for (const [word, d] of leaseDateWords) if (text.includes(word)) found.push(`lease date "${word}" (${d})`);
  const dated = /\b(Leased since|Moves in|moves in|Commence[sd]?|Vacated|Vacates|Projected vacancy|vacated)\b/.exec(text);
  if (dated) found.push(`lease date wording "${dated[0]}"`);
  // No total by period, no expiring figure, no lease count: with every suite's RSF on the page they name suites.
  const period = /< ?12 mo\b|\b\d–\d yr\b|\b\d\+ yr\b|\bLease rollover\b|\bRollover from\b|\bShare of (leased|listed)|\b\d+ leases?\b|\bleases? ending\b/.exec(text);
  if (period) found.push(`rollover by period "${period[0]}"`);
  if (expiringFigure && text.includes(expiringFigure)) found.push(`the expiring figure "${expiringFigure}"`);
  // No WALT figure: not the card's two decimals, not the tooltip's four, not in months, in any output.
  const walt = waltFigure ? new RegExp(`\\b${waltFigure.replace('.', '\\.')}\\s*(yr|years)\\b`).exec(text) : null;
  if (walt) found.push(`the WALT figure "${walt[0].replace(/\s+/g, ' ')}"`);
  const waltWords = /WALT[^\n]{0,40}\b\d+\.\d+\s*(yr|years)\b|\b\d+\.\d{4} years\b|lease term remaining: \d|SF-weighted/i.exec(text);
  if (waltWords) found.push(`a WALT figure is stated: "${waltWords[0]}"`);
  // A sublease says nothing about when it ends, or whose lease it is cut from.
  const sub = /\bthru\b|\bsublandlord\b|\bhead lease\b|\bopen-ended\b/i.exec(text);
  if (sub) found.push(`sublease term wording "${sub[0]}"`);
  // No inquiry: not the word, not its id in the URL, not its size range as a requirement.
  const inq = /inquir/i.exec(text);
  if (inq) found.push(`inquiry wording "${text.slice(Math.max(0, inq.index - 20), inq.index + 30).replace(/\s+/g, ' ')}"`);
  for (const i of inquiryList) if (text.includes(i.range)) found.push(`the size range of inquiry ${i.id} "${i.range}"`);
  // No lens that colours by something withheld: not in the URL either.
  const lens = /[?&]lens=(expiry|deals)\b/.exec(text);
  if (lens) found.push(`a withheld lens in the URL "${lens[0]}"`);
  const expiring = /expiring in 12 months[^.;\n]*\d/i.exec(text);
  if (expiring) found.push(`an expiring figure is stated: "${expiring[0]}"`);
  // The plan is today's: no other as-of date in the URL, no change chip against today.
  if (/[?&]asOf=/.test(text)) found.push('an as-of date in the URL');
  if (/\bProjected · |\(projected\)/.test(text)) found.push('a projected as-of date');
  for (const a of quietAsks) if (text.includes(a)) found.push(`a quiet listing's asking rent "${a}"`);
  const broken = /\bNaN\b|\bundefined\b|Invalid Date/.exec(text);
  if (broken) found.push(`broken text "${broken[0]}"`);
  return found;
}

/** Rules that need the DOM, not its text. */
async function findDomLeaks() {
  const found = [];
  const riskGeom = await page.evaluate(() => document.querySelectorAll('.sp-tl-bar__ext--risk, .sp-tl-tag--risk').length);
  if (riskGeom) found.push(`risk geometry (${riskGeom})`);
  // A quiet listing is never drawn, whatever the suite's state: no block, slice or bar carries its record.
  const quietDrawn = await page.evaluate((ids) => ids.filter((id) => document.querySelector(`[data-key="${id}"], [data-seg="${id}"], [data-bar^="tl-${id}"]`)), quietIds);
  if (quietDrawn.length) found.push(`quiet listing drawn (${quietDrawn.join(', ')})`);
  // The date cannot be moved: no slider, no rollover band, and the as-of control opens nothing.
  const movable = await page.evaluate(() => ({
    sliders: document.querySelectorAll('[role="slider"]').length,
    bands: document.querySelectorAll('.sp-tl-band__col, .sp-tl-roll, .sp-roll').length,
    asOf: [...document.querySelectorAll('.sp-header__asof button')].filter((b) => b.getAttribute('aria-disabled') !== 'true').length,
    ended: document.querySelectorAll('.sp-tl-bar--projected, [data-bar^="tl-hist-"]').length,
  }));
  if (movable.sliders) found.push(`the as-of date can be dragged (${movable.sliders} slider)`);
  if (movable.bands) found.push(`a rollover band or chart is drawn (${movable.bands})`);
  if (movable.asOf) found.push('the as-of control is not locked');
  if (movable.ended) found.push(`an ended lease is drawn (${movable.ended})`);
  // The Expiration and Deals lenses are not offered: not as a button, not in the phone's select.
  const lensOptions = await page.evaluate(() => [...document.querySelectorAll('.sp-toolbar__lens [role="radio"], .sp-toolbar__lens button, .sp-toolbar__lens-select option')].map((el) => (el.textContent ?? '').trim()));
  const withheldLens = lensOptions.filter((t) => /Expiration|Deals/.test(t));
  if (withheldLens.length) found.push(`a withheld lens is offered (${[...new Set(withheldLens)].join(', ')})`);
  if (lensOptions.length && !lensOptions.some((t) => /Status/.test(t))) found.push('the lens control was not read');
  // Every sublease bar and block is drawn with no end: nothing stops on the sublandlord's lease end.
  const subEnds = await page.evaluate(() => document.querySelectorAll('[data-bar$="-sub"]').length);
  if (subEnds) found.push(`a sublease bar with an end date is drawn (${subEnds})`);
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
// The figure the broker's Expiring 12 mo card shows: it must be nowhere on a prospect's page.
const expiringFigure = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.sp-kpi')].find((c) => c.querySelector('.sp-kpi__label')?.textContent === 'Expiring 12 mo');
  const n = card?.querySelector('.sp-kpi__value')?.textContent?.match(/[\d,]{4,}/)?.[0];
  return n ? `${n} SF` : null;
});
if (!expiringFigure) {
  console.error('Could not read the Expiring 12 mo figure from the broker view: the check for it would prove nothing.');
  process.exit(2);
}
// The broker's WALT figure ("2.98"): it must be nowhere on a prospect's page, print or file.
const waltFigure = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.sp-kpi')].find((c) => c.querySelector('.sp-kpi__label')?.textContent === 'WALT');
  return card?.querySelector('.sp-kpi__value')?.textContent?.match(/\d+\.\d{2}/)?.[0] ?? null;
});
if (!waltFigure) {
  console.error('Could not read the WALT figure from the broker view: the check for it would prove nothing.');
  process.exit(2);
}
const riskKeys = kinds.filter(([, a]) => /Holdover|MTM|Month-to-month/.test(a)).map(([k]) => k);
const ordinaryKeys = kinds.filter(([, a]) => /\bExp [A-Z]/.test(a) && !/Holdover|MTM|Month-to-month|sublease/i.test(a)).map(([k]) => k);
if (riskKeys.length < 2 || ordinaryKeys.length < 5) {
  console.error(`Could not tell at-risk from ordinary leases in the broker view (${riskKeys.length} at risk, ${ordinaryKeys.length} ordinary): the check would prove nothing.`);
  process.exit(2);
}

/**
 * One link, read in full: the page as loaded, then every list behind a tab. Returns the text and
 * whatever the DOM rules found.
 */
async function read(qs) {
  await page.goto(base + qs, { waitUntil: 'networkidle' });
  // Long enough for the live region's summary of the as-of date (it is written 400 ms after the load).
  await page.waitForTimeout(qs.includes('map') ? 1500 : 600);
  let text = await grab();
  const dom = await findDomLeaks();
  // Lists behind tabs render only once their tab is chosen: open every tab and check what it shows.
  const tabs = page.locator('.sp-flists__tabs [role="radio"]');
  for (let i = 0; i < (await tabs.count()); i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(80);
    text += '\n' + (await grab());
  }
  return { text, dom };
}

/** Where two readings first differ, as a short quote of each. */
function firstDifference(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  const i = la.findIndex((line, n) => line !== lb[n]);
  const at = i === -1 ? la.length : i;
  const cut = (t) => (t === undefined ? '(nothing)' : `"${t.length > 110 ? `${t.slice(0, 110)}…` : t}"`);
  return `today ${cut(la[at])} ≠ later ${cut(lb[at])}`;
}

/** The same link with its as-of date replaced. */
const withAsOf = (qs, date) => {
  const p = new URLSearchParams(qs.slice(1));
  p.set('asOf', date);
  return `?${p.toString()}`;
};

// ── Fresh loads, and each of them again for later as-of dates ──────────────────────────────────
for (const qs of states) {
  if (!wanted(qs)) continue;
  const { text, dom } = await read(qs);
  const found = [...dom, ...findLeaks(text, { q: new URLSearchParams(qs).get('q') })];
  // Search must not confirm a tenant by highlighting
  if (qs.includes('q=anadarko')) {
    const [dimmed, total] = await page.evaluate(() => [document.querySelectorAll('.sp-seg.is-dim').length, document.querySelectorAll('.sp-seg').length]);
    if (dimmed > 0 && dimmed < total) found.push(`search highlighted ${total - dimmed} block(s) for a tenant name in prospect-safe mode`);
  }
  report(qs, found);

  // Time travel: the link with a later as-of date is the same page as the link without one. Nothing
  // may differ: not a block, a title, an aria-label, the print layout, a live region or the URL.
  const today = new URLSearchParams(qs.slice(1)).has('asOf') ? (await read(withAsOf(qs, TODAY))).text : text;
  for (const months of AHEAD) {
    const date = addMonths(TODAY, months);
    const later = await read(withAsOf(qs, date));
    const drift = [...later.dom, ...findLeaks(later.text, { q: new URLSearchParams(qs).get('q') })];
    if (later.text !== today) drift.push(`the page differs from today's: ${firstDifference(today, later.text)}`);
    report(`${qs} · as of +${months} mo (${date})`, drift);
  }
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
  ['match an open inquiry (by link)', '?view=stack&inquiry=I02', async () => {}, '15,000–22,000'],
  ['match an open inquiry from the Find panel', '?view=stack&mode=find', async () => { await page.getByLabel('Match an open inquiry').selectOption('I02'); }, 'Harbor Freight Regional HQ'],
  ['match an open inquiry, then open one of its options', '?view=stack&inquiry=I02', async () => { await page.locator('.sp-ins__list .sp-ins__row').first().click(); }, '15,000–22,000'],
  ['match an open inquiry on the Building view', '?view=building&inquiry=I05', async () => {}, '12,000–14,000'],
  ['match an open inquiry in the Timeline', '?view=timeline&inquiry=I01&mode=find', async () => {}, '5,000–6,000'],
  ['the sublease selected (its end date on screen)', '?view=stack&select=L14-U2', async () => {}, 'thru'],
  ['the sublease selected in the Timeline', '?view=timeline&select=L14-U2', async () => {}, 'thru'],
  ['the expiration lens in the Stack', '?view=stack&lens=expiry', async () => {}, 'Expiration'],
  ['the WALT figure on screen', '?view=stack', async () => {}, 'WALT'],
  ['the deals lens with a suite selected', '?view=stack&lens=deals&select=A02', async () => {}, null],
  ['the expiration lens in the Timeline, projected to 2028', '?view=timeline&lens=expiry&asOf=2028-01-01', async () => {}, null],
  ['the Stack projected to April 2027 (a suite vacated, a quiet listing open)', '?view=stack&asOf=2027-04-15', async () => {}, 'Vacated'],
  ['the Stack projected, with the suite of the quiet listing selected', '?view=stack&asOf=2027-04-15&select=A04', async () => {}, 'Quiet'],
  ['the Building view projected two years, Floor 6 open', '?view=building&floor=F6&asOf=2028-11-09', async () => {}, null],
  ['the date moved from the as-of popover (+12 mo)', '?view=stack', async () => { await page.getByRole('button', { name: /^As of / }).click(); await page.getByRole('button', { name: '+12 mo', exact: true }).click(); await page.keyboard.press('Escape'); }, 'Projected'],
  ['the date moved with the Timeline cursor (keyboard)', '?view=timeline', async () => { await page.getByRole('slider', { name: 'As-of date' }).focus(); await page.keyboard.press('PageUp'); await page.keyboard.press('PageUp'); }, 'Projected'],
  ['the rollover chart on screen (Building panel)', '?view=stack', async () => {}, '< 12 mo'],
  ['a signed lease selected (its move-in date on screen)', '?view=stack&select=L09-U1', async () => {}, 'Moves in'],
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

// ── The prospect-safe CSV export, today and for a later date ───────────────────────────────────
/** Download the rent roll from the Export menu of the page as loaded. */
async function exportCsv(qs) {
  await page.goto(base + qs, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Export' }).click();
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.getByRole('menuitem', { name: /Rent roll \(CSV\)/ }).click()]);
  return { csv: readFileSync(await download.path(), 'utf8'), name: download.suggestedFilename() };
}
if (wanted('prospect-safe CSV export')) try {
  const { csv, name } = await exportCsv('?view=stack&safe=1');
  const found = findLeaks(csv);
  const rows = csv.split(/\r?\n/).map((r) => r.split(','));
  const col = (h) => rows[0].indexOf(h);
  for (const r of rows.slice(1)) if (r[col('State')] === 'Leased' && (r[col('Expiration')] || r[col('Months remaining')] || r[col('Rate')])) found.push(`CSV: Ste ${r[col('Suite')]} shows a term or rent`);
  // No lease has a start or an end in the file, and no sublease an end: no row has a date in those columns at all.
  for (const r of rows.slice(1)) {
    if (r[col('Commencement')]) found.push(`CSV: Ste ${r[col('Suite')]} has a commencement (${r[col('Commencement')]})`);
    if (r[col('Expiration')]) found.push(`CSV: Ste ${r[col('Suite')]} (${r[col('State')]}) has an expiration (${r[col('Expiration')]})`);
    if (r[col('Months remaining')]) found.push(`CSV: Ste ${r[col('Suite')]} has months remaining`);
  }
  // The only dates a prospect-safe file may hold at all are none: the rent roll has no available-from column.
  const anyDate = /\b\d{4}-\d{2}-\d{2}\b/.exec(csv);
  if (anyDate) found.push(`CSV: a date is in the file (${anyDate[0]})`);
  if (/WALT|weighted/i.test(csv)) found.push('CSV: a WALT figure or heading is in the file');
  if (!rows.some((r) => r[col('State')] === 'Committed')) found.push('CSV: the signed lease is missing, so its dates were not checked');
  // Asking rents are marketing information: the sublet suite's must be in the file, as it is in the PDF.
  if (!rows.some((r) => r[col('State')] === 'Sublease' && /^\d+(\.\d+)?–\d+(\.\d+)?$/.test(r[col('Rate')] ?? ''))) found.push('CSV: the sublease asking rent is missing');
  report('prospect-safe CSV export', found);
  // A link with a later as-of date exports the same file under the same name: today's.
  for (const months of AHEAD) {
    const date = addMonths(TODAY, months);
    const later = await exportCsv(`?view=stack&safe=1&asOf=${date}`);
    const drift = [];
    if (later.csv !== csv) drift.push(`the file differs from today's: ${firstDifference(csv, later.csv)}`);
    if (later.name !== name || later.name.includes(date)) drift.push(`the file name differs or carries the date (${later.name})`);
    report(`prospect-safe CSV export · as of +${months} mo (${date})`, drift);
  }
} catch (e) {
  leaks++;
  console.log(`FAIL prospect-safe CSV export: ${String(e.message).split('\n')[0]}`);
}

// ── The prospect-safe print layout ─────────────────────────────────────────────────────────────
// It is in the DOM of every state above, so every rule has already read it; this reads it alone and
// proves the report is there to be read (an empty report would pass every rule).
if (wanted('prospect-safe print layout')) {
  await page.goto(base + '?view=stack&safe=1&print=1', { waitUntil: 'networkidle' });
  const printed = (await page.evaluate(() => document.querySelector('.sp-print')?.innerText ?? '')).replace(/\u00a0/g, ' ');
  const found = findLeaks(printed);
  // WALT reads "Withheld" beside Expiring 12 mo and Pipeline: three cards, no figure.
  const withheldCards = await page.evaluate(() => [...document.querySelectorAll('.sp-print__kpi')].filter((k) => k.querySelector('.sp-print__kpi-value')?.textContent === 'Withheld').map((k) => k.querySelector('.sp-print__kpi-label')?.textContent));
  for (const card of ['Expiring 12 mo', 'WALT', 'Pipeline']) if (!withheldCards.includes(card)) found.push(`the report's ${card} card does not read "Withheld"`);
  // The sublease is listed as space on offer, with its asking rent.
  if (!/Sublease\s+Now\s+\$\d+–\$\d+\/SF\/yr/.test(printed)) found.push('the report does not list the sublease as space on offer with its asking rent');
  for (const must of ['Rent roll', 'Available from', 'Space on offer', 'Coming supply', 'Withheld']) if (!printed.toLowerCase().includes(must.toLowerCase())) found.push(`the report has no "${must}": it was not read`); // table headings are drawn in capitals
  for (const h of ['Commencement', 'Expiration', 'Remaining', 'Leases', 'Period']) if (new RegExp(`(^|\\n|\\t)${h}(\\t|\\n|$)`, 'i').test(printed)) found.push(`the report has a "${h}" column`);
  report('prospect-safe print layout', found);
}

await browser.close();
if (leaks) {
  console.error(`\n${leaks} leak(s)`);
  process.exit(1);
}
console.log('\n0 leaks');
