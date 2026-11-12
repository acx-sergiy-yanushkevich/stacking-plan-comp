import { canUseLens } from '../../domain/safe';

/**
 * The order of the toolbar's controls that come and go with prospect-safe mode.
 *
 * A control that the mode removes must not move the ones that stay. So in every group the controls a
 * prospect is also given come first, in their usual order, and those that are withheld come last: taking
 * the last ones away leaves the rest where they were.
 */
export function prospectFirst<T extends { id: string }>(lenses: readonly T[]): T[] {
  return [...lenses.filter((l) => canUseLens(l.id, true)), ...lenses.filter((l) => !canUseLens(l.id, true))];
}

/**
 * What the search field says when empty, fullest first: the first that fits the field is shown. It names a
 * size too, with an example, because the box also reads a requirement ("12k direct by Jun 2027") and sends
 * it to Find space (round 23: the size path could not be found from a box that named only names).
 */
export const SEARCH_HINTS = {
  owner: ['Find tenant, suite, prospect or size (12k SF)', 'Tenant, suite, prospect or size', 'Tenant, suite or size', 'Search the plan', 'Search'],
  // Prospect-safe search skips tenants and prospects.
  safe: ['Find suite, floor or size (12k SF)', 'Suite, floor or size', 'Suite or floor', 'Search'],
} as const;

/**
 * The fullest of `options` that is no wider than `room` px (`widthOf` measures one in the field's font);
 * the shortest when none fits, and the fullest before the field has been measured. A placeholder is
 * never cut: a shorter one is shown.
 */
export function hintThatFits(options: readonly string[], room: number | null, widthOf: (text: string) => number): string {
  if (room === null) return options[0];
  return options.find((o) => widthOf(o) <= room) ?? options[options.length - 1];
}
