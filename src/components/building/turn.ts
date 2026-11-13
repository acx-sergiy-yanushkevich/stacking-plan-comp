/**
 * How far the building model is turned in the Building view. It stands at a corner view (two walls in
 * sight); each turn adds a quarter, so every stop shows two walls (a face-on view would show one flat wall).
 * With a floor open it faces front (0), to match the floor plate beside it.
 */

/** The usual corner view, in degrees about the vertical axis. */
export const ALONE_ANGLE = -34;

/** The angle of `turn` quarter turns (0–3) from the usual corner view. */
export const turnAngle = (turn: number): number => ALONE_ANGLE + 90 * turn;

/**
 * The angle equal to `to` (in whole turns of 360°) that is closest to `from`: the model then turns the
 * short way, so a turn from the last quarter to the first is a quarter, not three quarters back.
 */
export function nearestTurn(from: number, to: number): number {
  return to + 360 * Math.round((from - to) / 360);
}
