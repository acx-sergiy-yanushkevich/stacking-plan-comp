import type { LeaseType, RateUnit } from './types';

const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct1 = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Exact SF, never rounded or abbreviated (a top complaint about competitor tools). */
export const sf = (n: number) => `${int.format(n)} SF`;
export const num = (n: number) => int.format(n);
export const pct = (ratio: number) => pct1.format(ratio);

/**
 * Shares rounded to tenths of a percent so that, printed, they add up to their own total rounded once
 * (largest remainder): eight legend shares of 245,900 recorded SF over 245,400 leasable print a sum of
 * 100.2%, not the 100.4% that rounding each one alone gave (round 18). Each result is within 0.1 point of
 * its share; the order of the input is kept.
 */
export function apportion(shares: readonly number[]): number[] {
  const units = shares.map((s) => s * 1000);
  const floors = units.map(Math.floor);
  let left = Math.round(units.reduce((a, b) => a + b, 0)) - floors.reduce((a, b) => a + b, 0);
  const order = units.map((u, i) => [u - floors[i], i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors.map((f) => f / 1000);
}

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
