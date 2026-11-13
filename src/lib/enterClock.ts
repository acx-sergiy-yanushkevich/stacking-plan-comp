/**
 * When the view on the stage arrived, so its entrance plays once.
 *
 * The stage remounts its content when the web fonts arrive (App, `fontTick`), which may be a few hundred
 * milliseconds after the first paint. A CSS animation restarts on a remount, so the entrance would play
 * twice and stutter. Instead the stage hands its content `--sp-enter-shift`: 0 ms when a view (or a
 * building) has just been switched to, and minus the time since then on a remount, so the entrance
 * resumes where it was (a negative delay starts an animation part-way through) or, long after, shows the
 * view at rest.
 */
export interface EnterClock {
  /** What arrived: the view and the building (`stack:preston-park`). */
  enter: string;
  /** The stage's mount: changes when its content is remounted. */
  epoch: string;
  /** When `enter` arrived, in ms on the page's clock. */
  at: number;
  /** How far into the entrance the current mount starts, in ms. */
  shift: number;
}

export function enterShift(prev: EnterClock | null, enter: string, epoch: string, now: number): EnterClock {
  if (!prev || prev.enter !== enter) return { enter, epoch, at: now, shift: 0 };
  if (prev.epoch !== epoch) return { ...prev, epoch, shift: now - prev.at };
  return prev;
}
