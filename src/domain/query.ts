import type { Segment } from './derive';
import type { FitType } from './finder';
import type { ISODate } from './types';

/**
 * What a search-box query asks for, beyond a name: a size of space ("12000 sf", "12k direct by Jun 2027",
 * "12-15k") that belongs in Find space, or a state of space ("sublease", "available space", "subleases on
 * floor 7") that the plan can light. Todd types a requirement into the only box he sees; the box sends it
 * to the tool that answers it (round 21 and 22: "12000 sf" found nothing).
 *
 * A state can be held to one floor (`floor`, the number in "Floor 7"); null means every floor. `now` holds it
 * to space a tenant could take on the plan's date, as the Available KPI counts it (not space available later).
 */
export type QueryIntent =
  | { kind: 'size'; size: number; max: number | null; fit: FitType; by: ISODate | null; badBy?: string; unread?: string[] }
  | { kind: 'state'; label: string; kinds: ReadonlySet<Segment['kind']>; tenantRisk: boolean; floor: string | null; now: boolean };

const NUM = String.raw`(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)`;
const UNIT = String.raw`(sf|rsf|sq\.?\s*ft|square\s+feet|feet)?`;
const RANGE = new RegExp(String.raw`(?<![\w.,])${NUM}\s*(k)?\s*(?:-|–|to)\s*${NUM}\s*(k)?\s*${UNIT}(?![a-z])`, 'gi');
const SINGLE = new RegExp(String.raw`(?<![\w.,])${NUM}\s*(k)?\s*${UNIT}(?![a-z])`, 'gi');

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;
/**
 * A needed-by date anywhere in a query, with the word before it when there is one: a quarter ("Q2",
 * "Q2 2027"), a month with or without its year ("Jun 2027", "june"), "6/2027", an ISO date, or a year.
 * Group 1 is the word ("by", "before", "in", "for", "needed by"), group 2 the date.
 */
const DATE_AT = new RegExp(
  String.raw`(?<![\w/-])(?:(needed\s+by|by|before|in|for)\s+)?(?:(?:the\s+)?end\s+of\s+)?(q[1-4](?:\s*,?\s*\d{4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2})|\d{1,2}\/\d{4}|\d{1,2}(?:st|nd|rd|th)?\s+${MONTH}(?:\s*,?\s*\d{4})?|${MONTH}(?:\s+\d{1,2}(?:st|nd|rd|th)?(?!\d))?(?:\s*,?\s*\d{4})?|20\d{2})(?![\w/-])`,
  'gi',
);

/** State words and the kinds of space they light; `tenantRisk` words say nothing to a prospect. */
const STATES: ReadonlyArray<{ words: string[]; label: string; kinds: Segment['kind'][]; tenantRisk?: boolean; now?: boolean }> = [
  // The space a tenant could take today, direct or sublease: what the Available KPI counts.
  { words: ['available', 'availability', 'availabilities', 'vacant', 'vacancy', 'vacancies'], label: 'Available', kinds: ['available', 'sublease'], now: true },
  { words: ['sublease', 'subleases', 'sublet', 'sublets'], label: 'Sublease', kinds: ['sublease'] },
  { words: ['holdover', 'holdovers'], label: 'Holdover', kinds: ['holdover'], tenantRisk: true },
  { words: ['month-to-month', 'month to month', 'mtm'], label: 'Month-to-month', kinds: ['mtm'], tenantRisk: true },
  { words: ['at risk', 'risk'], label: 'Holdover / month-to-month', kinds: ['holdover', 'mtm'], tenantRisk: true },
  { words: ['for sale', 'sale', 'condo', 'condos'], label: 'For sale', kinds: ['forsale'] },
  { words: ['signed not yet in', 'signed', 'committed'], label: 'Signed, not yet in', kinds: ['committed'] },
];

/** Every state word, the longest first, so "at risk" is read before "risk" and "for sale" before "sale". */
const STATE_WORDS = STATES.flatMap((s) => s.words.map((w) => ({ w, s }))).sort((a, b) => b.w.length - a.w.length);

/** Words around a state word that do not change what is asked: "available space", "show me the subleases". */
const FILLER = new Set(['space', 'spaces', 'suite', 'suites', 'sf', 'rsf', 'area', 'areas', 'the', 'a', 'an', 'all', 'any', 'show', 'me', 'list', 'find', 'on', 'in', 'at', 'of', 'what', 'which', 'where', 'is', 'are', 'now', 'today', 'unit', 'units', 'block', 'blocks', 'lease', 'leases', 'tenant', 'tenants', 'with', 'that', 'and', 'only', 'office']);

const FLOOR_REF = /(?<![\w-])(?:floor|fl|level)\s*(\d{1,3})(?![\w-])/;

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const endOfMonth = (y: number, m: number): ISODate => `${y}-${pad(m)}-${pad(lastDay(y, m))}`;

/**
 * "Jun 2027", "june", "Q3 2027", "Q2", "6/2027", "2027-06-15", "2027": the last day of the month, quarter
 * or year named (needed by June = in by the end of June), or the date itself. A month or quarter without a
 * year is the next one on or after `asOf`. Null when the words are not a date.
 */
/** A date the calendar has: "2027-02-30" is shaped like one and is not (round 26). */
const realDay = (iso: string) => {
  const t = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === iso;
};

/** The last day before the period or day `date` names, given the end `by` it was read as. */
function beforeBy(date: string, by: ISODate): ISODate {
  if (/^\d{4}$/.test(date)) return `${Number(date) - 1}-12-31`;
  const d = new Date(`${by}T00:00:00Z`);
  const dayNamed = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/|^\d{1,2}(?:st|nd|rd|th)?\s+[a-z]|^[a-z]+\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/.test(date.replace(/,/g, ' ').replace(/\s+/g, ' '));
  if (dayNamed) {
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10) as ISODate;
  }
  const back = /^q[1-4]/.test(date) ? 3 : 1;
  return endOfMonth(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back + 1, 0)).getUTCFullYear(), new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back + 1, 0)).getUTCMonth() + 1);
}

export function readBy(words: string, asOf: ISODate): ISODate | null {
  const w = words.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').replace(/\.$/, '');
  const asY = Number(asOf.slice(0, 4));
  const asM = Number(asOf.slice(5, 7));
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(w);
  if (iso) return realDay(w) ? (w as ISODate) : null;
  const year = /^(\d{4})$/.exec(w);
  if (year) return `${year[1]}-12-31`;
  const q = /^q([1-4])(?:\s+(\d{4}))?$/.exec(w);
  if (q) {
    const m = Number(q[1]) * 3;
    const y = q[2] ? Number(q[2]) : m >= asM ? asY : asY + 1;
    return endOfMonth(y, m);
  }
  // M/D/YYYY, the way a US broker writes a date (round 30: "by 6/1/2027" was dropped without a word).
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/.exec(w);
  if (us) {
    // "31/12/27": a month over 12 with a day that fits one is day first.
    if (Number(us[1]) > 12 && Number(us[2]) <= 12) [us[1], us[2]] = [us[2], us[1]];
    const day = `${us[3].length === 2 ? `20${us[3]}` : us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
    return realDay(day) ? (day as ISODate) : null;
  }
  // Day first: "15 Jan 2027", "3rd March".
  const dayFirst = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?(?:\s+(\d{4}))?$/.exec(w);
  if (dayFirst) return readBy(`${dayFirst[2]} ${dayFirst[1]}${dayFirst[3] ? ` ${dayFirst[3]}` : ''}`, asOf);
  const slash = /^(\d{1,2})\/(\d{4})$/.exec(w);
  if (slash && Number(slash[1]) >= 1 && Number(slash[1]) <= 12) return endOfMonth(Number(slash[2]), Number(slash[1]));
  // A month, with a day (round 29: "February 15, 2028" was read as the end of February 2027) and a year.
  const named = /^([a-z]+)\.?(?:\s+(\d{1,2})(?:st|nd|rd|th)?(?!\d))?(?:\s+(\d{4}))?$/.exec(w);
  if (named) {
    const i = named[1].length >= 3 ? MONTHS.findIndex((m) => m.startsWith(named[1])) : -1;
    if (i < 0) return null;
    const m = i + 1;
    // A day without a year is the next such day on or after the as-of date (round 30: "Nov 5" with an as-of date of
    // Nov 9 read Nov 5 of this year, four days past).
    const asD = Number(asOf.slice(8, 10));
    const y = named[3] ? Number(named[3]) : named[2] ? (m > asM || (m === asM && Number(named[2]) >= asD) ? asY : asY + 1) : m >= asM ? asY : asY + 1;
    if (named[2]) {
      const day = `${y}-${String(m).padStart(2, '0')}-${named[2].padStart(2, '0')}`;
      return realDay(day) ? (day as ISODate) : null;
    }
    return endOfMonth(y, m);
  }
  return null;
}

/**
 * The needed-by date in a query and the query without its words ("12k by Jun 2027 direct" → Jun 30, 2027
 * and "12k direct"). Only the date and the word before it are cut. A bare year counts only after a word
 * ("in 2027", not "2027", which may be a suite), and so does a bare "may" (a word before it in English too).
 */
export function cutDate(text: string, asOf: ISODate): { by: ISODate | null; rest: string; bad?: string } {
  for (const m of text.matchAll(DATE_AT)) {
    const word = m[1]?.toLowerCase().replace(/\s+/g, ' ');
    const date = m[2].toLowerCase();
    if (!word && (/^\d{4}$/.test(date) || /^may\.?$/.test(date))) continue;
    let by = readBy(date, asOf);
    // A date shaped like one that the calendar has not ("by 2027-02-30") is cut and named, never dropped quietly
    // (round 26: the search offered "Feb 30, 2027", then ran with no needed-by date at all).
    if (!by && (/^\d{4}-\d{2}-\d{2}$/.test(date) || /^\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2})$/.test(date) || /^\d{1,2}(?:st|nd|rd|th)?\s+[a-z]/.test(date) || /^[a-z]+\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/.test(date.replace(/,/g, ' ')))) {
      const at = m.index ?? 0;
      return { by: null, bad: date.replace(/\b[a-z]/g, (c) => c.toUpperCase()), rest: `${text.slice(0, at)} ${text.slice(at + m[0].length)}`.replace(/\s+/g, ' ').trim() };
    }
    if (!by) continue;
    // "Before" leaves the named day, month, quarter or year out (round 31: "before April 1, 2027" admitted space that
    // opens on April 1): "before 2027" is by the end of 2026, "before Q2" by the end of Q1, "before June" by the
    // end of May, "before April 1" by March 31.
    if (word === 'before') by = beforeBy(date, by);
    const at = m.index ?? 0;
    return { by, rest: `${text.slice(0, at)} ${text.slice(at + m[0].length)}`.replace(/\s+/g, ' ').trim() };
  }
  return { by: null, rest: text };
}

/** Words in a requirement that mean something already read, or nothing at all ("need 12k SF of contiguous space"). */
const SIZE_WORDS = new Set(['sf', 'rsf', 'sq', 'ft', 'sq.', 'ft.', 'square', 'feet', 'k', 'direct', 'sublease', 'subleases', 'sublet', 'sublets', 'contiguous', 'space', 'spaces', 'block', 'blocks', 'suite', 'suites', 'office', 'need', 'needs', 'needed', 'find', 'looking', 'for', 'a', 'an', 'the', 'of', 'to', 'by', 'in', 'before', 'at', 'with', 'and', 'or', 'about', 'around', 'approx', 'approximately', 'sf.', 'rsf.']);

/**
 * What a requirement says that the search does not use (round 31: "15k nnn under $35" ran as "15k" with the rest
 * dropped without a word): a word it does not know, or a price. Numbers, the size and its unit are read, not listed.
 */
function unreadWords(rest: string, size: number, max: number | null): string[] {
  const out: string[] = [];
  for (const raw of rest.split(/\s+/)) {
    const t = raw.replace(/^[^\w$]+|[^\w$]+$/g, '');
    if (!t || SIZE_WORDS.has(t) || /^[\d,.]+k?(?:-|–|to)[\d,.]+k?$/.test(t)) continue;
    // A number is read when it is the size ("12k", "12,000", "1200" before "sf"); any other ("5" in "for 5 years") is listed.
    const num = /^([\d,.]+)(k?)$/.exec(t);
    if (num) {
      const v = Number(num[1].replace(/,/g, '')) * (num[2] ? 1000 : 1);
      if (v === size || v === max) continue;
    }
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

/** The SF a number stands for: "12" with "k" is 12,000; "12,000" is 12,000. */
function sfOf(n: string, k: boolean): number {
  const v = Number(n.replace(/,/g, ''));
  return Math.round(k ? v * 1000 : v);
}

/**
 * A size or a range in the words, or null. A "k" belongs to the number it follows, except that a trailing
 * one covers a bare first number too ("12-15k" is 12,000–15,000; "12,000-15k" and "12k to 15000 sf" are
 * too). A range given high to low is read low to high ("15k-12k").
 */
function readSize(text: string): { size: number; max: number | null } | null {
  for (const r of text.matchAll(RANGE)) {
    const [, n1, k1, n2, k2, unit] = r;
    const v1 = Number(n1.replace(/,/g, ''));
    const lo = sfOf(n1, !!k1 || (!!k2 && !n1.includes(',') && v1 < 1000));
    const hi = sfOf(n2, !!k2);
    const [a, b] = lo <= hi ? [lo, hi] : [hi, lo];
    if (a >= 100 && (k1 || k2 || unit || /,/.test(n1 + n2) || b >= 10000)) return { size: a, max: b === a ? null : b };
  }
  for (const one of text.matchAll(SINGLE)) {
    const [, n, k, unit] = one;
    const digits = n.replace(/[,.]/g, '').length;
    const isSize = !!k || !!unit || n.includes(',') || digits >= 5;
    const size = sfOf(n, !!k);
    if (isSize && size >= 100) return { size, max: null };
  }
  return null;
}

/**
 * A state word in the query, alone or among words that do not change it ("available space", "subleases on
 * floor 7"). A query with any other word is a name for the text search ("Delta sublease" is not every
 * sublease). Null when there is no state word.
 */
function readState(text: string): Extract<QueryIntent, { kind: 'state' }> | null {
  let t = ` ${text.replace(/[,;:!?()"“”]/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const hit = STATE_WORDS.find(({ w }) => t.includes(` ${w} `));
  if (!hit) return null;
  t = t.replace(` ${hit.w} `, ' ');
  const floorRef = FLOOR_REF.exec(t);
  if (floorRef) t = t.replace(floorRef[0], ' ');
  const s = hit.s;
  // A second word of the same state ("condo for sale") says nothing more.
  const own = new Set(s.words);
  const rest = t.split(' ').filter(Boolean);
  if (rest.some((w) => !FILLER.has(w) && !own.has(w))) return null;
  return { kind: 'state', label: s.label, kinds: new Set(s.kinds), tenantRisk: !!s.tenantRisk, floor: floorRef ? String(Number(floorRef[1])) : null, now: !!s.now };
}

/**
 * Reads a search-box query. A size needs a sign that it is one, so a suite number ("1200") stays a suite:
 * "k", a unit ("sf", "rsf", "sq ft"), a thousands comma, or five digits or more. The needed-by date and the
 * kind of space can be anywhere in it ("20k contiguous SF, Q2, direct"). Without a size, a state word asks
 * for that state ("available space"). Null when the query is a name, a suite or a floor (the text search
 * answers those).
 */
export function readQuery(q: string, asOf: ISODate): QueryIntent | null {
  const text = q.trim().toLowerCase();
  if (!text) return null;

  const { by, rest, bad } = cutDate(text, asOf);
  const size = readSize(rest);
  if (size) {
    let fit: FitType = 'any';
    if (/\bdirect\b/.test(rest)) fit = 'direct';
    else if (/\bsub(?:lease|let)s?\b/.test(rest)) fit = 'sublease';
    const unread = unreadWords(rest, size.size, size.max);
    return { kind: 'size', size: size.size, max: size.max, fit, by, ...(bad ? { badBy: bad } : {}), ...(unread.length ? { unread } : {}) };
  }
  return readState(text);
}
