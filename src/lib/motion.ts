/**
 * The motion tokens that script needs as numbers (docs/DESIGN.md §3.5). The stylesheets read the same
 * values from `styles/tokens.css`; `styles/motion.test.ts` fails when the two disagree, so the page has
 * one set of durations and one curve whoever drives the motion.
 */

/** `--sp-ease-move`: a crossfade or a sliding mark, in ms. */
export const MOVE_MS = 240;
/** `--sp-enter-curve`: the one ease-out curve of every move and entrance. */
export const MOVE_CURVE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
/** `--sp-exit-ms`: a popover, tooltip or toast leaving, in ms. Shorter than any entrance: what is dismissed gets out of the way. */
export const EXIT_MS = 110;
/** One step of "Play through time": long enough for the crossfade to finish and the plan to be read at rest. */
export const PLAY_STEP_MS = 700;
