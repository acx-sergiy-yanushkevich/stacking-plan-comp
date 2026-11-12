import type { Segment } from './derive';
import type { FitType } from './finder';
import type { ISODate } from './types';

/**
 * What a search-box query asks for, beyond a name: a size of space ("12000 sf", "12k direct by Jun 2027",
 * "12-15k") that belongs in Find space, or a state of space ("sublease", "holdover") that the plan can
 * light. Todd types a requirement into the only box he sees; the box sends it to the tool that answers it
 * (round 21 and 22: "12000 sf" found nothing).
 */
export type QueryIntent =
  | { kind: 'size'; size: number; max: number | null; fit: FitType; by: ISODate | null }
  | { kind: 'state'; label: string; kinds: ReadonlySet<Segment['kind']>; tenantRisk: boolean };

const NUM = String.raw`(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)`;
const UNIT = String.raw`(sf|rsf|sq\.?\s*ft|square\s+feet|feet)?`;
const RANGE = new RegExp(String.raw`${NUM}\s*(k)?\s*(?:-|–|to)\s*${NUM}\s*(k)?\s*${UNIT}`, 'i');
const SINGLE = new RegExp(String.raw`${NUM}\s*(k)?\s*${UNIT}`, 'i');

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** State words and the kinds of space they light; `tenantRisk` words say nothing to a prospect. */
const STATES: ReadonlyArray<{ words: string[]; label: string; kinds: Segment['kind'][]; tenantRisk?: boolean }> = [
  { words: ['available', 'availability', 'vacant', 'vacancy'], label: 'Available', kinds: ['available'] },
  { words: ['sublease', 'subleases', 'sublet'], label: 'Sublease', kinds: ['sublease'] },
  { words: ['holdover', 'holdovers'], label: 'Holdover', kinds: ['holdover'], tenantRisk: true },
  { words: ['month-to-month', 'month to month', 'mtm'], label: 'Month-to-month', kinds: ['mtm'], tenantRisk: true },
  { words: ['at risk', 'risk'], label: 'Holdover / month-to-month', kinds: ['holdover', 'mtm'], tenantRisk: true },
  { words: ['for sale', 'sale', 'condo'], label: 'For sale', kinds: ['forsale'] },
  { words: ['signed', 'signed, not yet in', 'committed'], label: 'Signed, not yet in', kinds: ['committed'] },
];

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const endOfMonth = (y: number, m: number): ISODate => `${y}-${pad(m)}-${pad(lastDay(y, m))}`;

/**
 * "by Jun 2027", "by june", "by Q3 2027", "by 6/2027", "by 2027-06-15": the last day of the month or quarter
 * named (needed by June = in by the end of June), or the date itself. A month or quarter without a year is
 * the next one on or after `asOf`. Null when the words are not a date.
 */
export function readBy(words: string, asOf: ISODate): ISODate | null {
  const w = words.trim().toLowerCase().replace(/\.$/, '');
  const asY = Number(asOf.slice(0, 4));
  const asM = Number(asOf.slice(5, 7));
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(w);
  if (iso) return w as ISODate;
  const q = /^q([1-4])(?:\s+(\d{4}))?$/.exec(w);
  if (q) {
    const m = Number(q[1]) * 3;
    const y = q[2] ? Number(q[2]) : m >= asM ? asY : asY + 1;
    return endOfMonth(y, m);
  }
  const slash = /^(\d{1,2})\/(\d{4})$/.exec(w);
  if (slash && Number(slash[1]) >= 1 && Number(slash[1]) <= 12) return endOfMonth(Number(slash[2]), Number(slash[1]));
  const named = /^([a-z]+)\.?,?(?:\s+(\d{4}))?$/.exec(w);
  if (named) {
    const i = named[1].length >= 3 ? MONTHS.findIndex((m) => m.startsWith(named[1])) : -1;
    if (i < 0) return null;
    const m = i + 1;
    const y = named[2] ? Number(named[2]) : m >= asM ? asY : asY + 1;
    return endOfMonth(y, m);
  }
  return null;
}

/** The SF a number stands for: "12" with "k" is 12,000; "12,000" is 12,000. */
function sfOf(n: string, k: string | undefined): number {
  const v = Number(n.replace(/,/g, ''));
  return Math.round(k ? v * 1000 : v);
}

/**
 * Reads a search-box query. A size needs a sign that it is one, so a suite number ("1200") stays a suite:
 * "k", a unit ("sf", "rsf", "sq ft"), a thousands comma, or five digits or more. Null when the query is a
 * name, a suite or a floor (the text search answers those).
 */
export function readQuery(q: string, asOf: ISODate): QueryIntent | null {
  let text = q.trim().toLowerCase();
  if (!text) return null;

  const state = STATES.find((s) => s.words.includes(text));
  if (state) return { kind: 'state', label: state.label, kinds: new Set(state.kinds), tenantRisk: !!state.tenantRisk };

  let by: ISODate | null = null;
  const byAt = /\b(?:by|before|needed by)\s+(.+)$/.exec(text);
  if (byAt) {
    by = readBy(byAt[1], asOf);
    if (by) text = text.slice(0, byAt.index).trim();
  }
  let fit: FitType = 'any';
  if (/\bdirect\b/.test(text)) fit = 'direct';
  else if (/\bsub(?:lease|let)s?\b/.test(text)) fit = 'sublease';

  const range = RANGE.exec(text);
  if (range) {
    const k = range[2] ?? range[4];
    const lo = sfOf(range[1], k ? range[2] ?? 'k' : undefined);
    const hi = sfOf(range[3], range[4] ?? range[2]);
    if (lo > 0 && hi >= lo && (k || range[5] || /,/.test(range[1] + range[3]) || hi >= 10000)) return { kind: 'size', size: lo, max: hi, fit, by };
  }
  const one = SINGLE.exec(text);
  if (one) {
    const digits = one[1].replace(/[,.]/g, '').length;
    const isSize = !!one[2] || !!one[3] || one[1].includes(',') || digits >= 5;
    const size = sfOf(one[1], one[2]);
    if (isSize && size >= 100) return { kind: 'size', size, max: null, fit, by };
  }
  return null;
}
