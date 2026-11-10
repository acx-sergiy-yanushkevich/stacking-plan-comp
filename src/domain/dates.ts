import type { ISODate } from './types';

const parse = (d: ISODate) => {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m, day };
};

/** Whole months from `from` to `to`, toward zero (negative when `to` is earlier). */
export function monthsBetween(from: ISODate, to: ISODate): number {
  const a = parse(from);
  const b = parse(to);
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if (months > 0 && b.day < a.day) months -= 1;
  if (months < 0 && b.day > a.day) months += 1;
  return months;
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export function yearsBetween(from: ISODate, to: ISODate): number {
  return (Date.parse(to) - Date.parse(from)) / (365.25 * 86_400_000);
}

export function addMonths(d: ISODate, n: number): ISODate {
  const { y, m, day } = parse(d);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

export const yearOf = (d: ISODate) => Number(d.slice(0, 4));

/** First day of the month containing `d`. */
export const startOfMonth = (d: ISODate): ISODate => `${d.slice(0, 7)}-01`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sep 2028" */
export function fmtMonthYear(d: ISODate): string {
  const { y, m } = parse(d);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "Sep 30, 2028" */
export function fmtDate(d: ISODate): string {
  const { y, m, day } = parse(d);
  return `${MONTHS[m - 1]} ${day}, ${y}`;
}

/** "Sep '28": compact form for narrow blocks. */
export function fmtMonthYearShort(d: ISODate): string {
  const { y, m } = parse(d);
  return `${MONTHS[m - 1]}\u00a0'${String(y).slice(2)}`;
}

/** 0 → "0 mo", 4 → "4 mo", 14 → "1 yr 2 mo", 24 → "2 yr", negative → "expired". */
export function fmtMonths(m: number): string {
  if (m < 0) return 'expired';
  if (m < 12) return `${m} mo`;
  const y = Math.floor(m / 12);
  const r = m % 12;
  return r ? `${y} yr ${r} mo` : `${y} yr`;
}
