import type { LeaseType, RateUnit } from './types';

const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct1 = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Exact SF, never rounded or abbreviated (a top complaint about competitor tools). */
export const sf = (n: number) => `${int.format(n)} SF`;
export const num = (n: number) => int.format(n);
export const pct = (ratio: number) => pct1.format(ratio);

const dollars = (v: number) => (Number.isInteger(v) ? `$${int.format(v)}` : money.format(v));

/** "$31.50/SF/yr FSG": a rate always carries its unit and lease type. */
export function rate(value: number, unit: RateUnit, type: LeaseType): string {
  return `${dollars(value)}/SF/${unit} ${type}`;
}

export function rateRange(low: number, high: number, unit: RateUnit, type: LeaseType): string {
  if (low === high) return rate(low, unit, type);
  return `${dollars(low)}–${dollars(high)}/SF/${unit} ${type}`;
}

/** Short rate for tight spaces, still with unit and type: "$31–$33/SF/yr FSG". */
export function compactRate(low: number, high: number, unit: RateUnit, type: LeaseType): string {
  const f = (v: number) => (Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`);
  const amount = low === high ? f(low) : `${f(low)}–${f(high)}`;
  return `${amount}/SF/${unit} ${type}`;
}

/** Normalise to annual $/SF for comparisons (rent lens, averages). */
export const annualRate = (value: number, unit: RateUnit) => (unit === 'mo' ? value * 12 : value);

export const usd = (n: number) => money.format(n);
export const usd0 = (n: number) => `$${int.format(n)}`;

/** "$68.5M", "$1.03M", "$395", "$12.4K" */
export function usdCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${sig3(abs / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${sign}$${sig3(abs / 1_000_000)}M`;
  if (abs >= 10_000) return `${sign}$${sig3(abs / 1_000)}K`;
  return `${sign}$${int.format(abs)}`;
}

/** 3 significant figures, trailing zeros dropped: 68.5, 1.03, 329. */
function sig3(v: number): string {
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  const s = v.toFixed(digits);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

/** Signed SF delta: "+1,200 SF", "−6,500 SF". */
export function sfDelta(n: number): string {
  if (n === 0) return '±0 SF';
  return `${n > 0 ? '+' : '−'}${int.format(Math.abs(n))} SF`;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${int.format(n)} ${n === 1 ? one : many}`;
}

/**
 * A distance to a tenth of a mile: "0.4 mi". A place nearer than that is "< 0.1 mi", never "0.0 mi" (round 25: live
 * OpenStreetMap data puts a parking lot or a bus stop at the building's door).
 */
export const mi = (d: number) => (d < 0.05 ? '< 0.1 mi' : `${d.toFixed(1)} mi`);

/** The same in words, for sentences and accessible names: "0.2 miles", "1.0 mile", "under 0.1 miles". */
export function inMiles(d: number): string {
  if (d < 0.05) return 'under 0.1 miles';
  const t = d.toFixed(1);
  return `${t} ${t === '1.0' ? 'mile' : 'miles'}`;
}

/** A figure kept on one line with its unit, and a "<" with its figure: those spaces become no-break spaces. */
export const keepUnits = (text: string) => text.replace(/< (\d)/g, '<\u00a0$1').replace(/(\d) (miles?|mi|minutes|min|years)\b/g, '$1\u00a0$2');
