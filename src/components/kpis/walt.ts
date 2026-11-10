import { canShowTenantRisk } from '../../domain/safe';

/** WALT as the KPI card shows it: two decimals. */
export const waltCard = (walt: number) => walt.toFixed(2);

/**
 * The WALT tooltip: the figure to four decimals and in months, how it is weighted, and what the
 * card rounds to, so no rounding goes unstated.
 */
export function waltTitle(walt: number, safe = false): string {
  // Prospect-safe never says which lease states exist in the building (tenant risk is withheld).
  const zero = canShowTenantRisk(safe) ? ' Holdover and month-to-month leases count as 0 years; signed leases that have not commenced are left out.' : ' Signed leases that have not commenced are left out.';
  return `Weighted average lease term remaining: ${walt.toFixed(4)} years (${(walt * 12).toFixed(2)} months), to four decimals; the card rounds to two. Each in-place lease counts its years to lease end, weighted by its SF.${zero} Click for the lease timeline.`;
}
