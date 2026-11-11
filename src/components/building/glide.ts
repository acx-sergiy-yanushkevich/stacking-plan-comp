/**
 * The geometry of a dock or an undock, so that what comes in beside the model can be timed from where
 * the model is, not from a guess: the model's box at any moment of its glide, and the moment from which
 * that box no longer touches a given place (the floor picker's, the list of floors').
 *
 * Pure functions: BuildingView measures the rectangles and runs the animations.
 */

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A CSS `cubic-bezier(x1, y1, x2, y2)` easing as a function of time, 0 to 1. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const at = (a: number, b: number, u: number) => 3 * a * u * (1 - u) * (1 - u) + 3 * b * u * u * (1 - u) + u * u * u;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // x(u) rises with u, so the parameter for a time is found by halving.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i += 1) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < t) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

/**
 * A glide: the box the model comes to rest in, how far its lower left corner sets out from there, and
 * how much larger (or smaller) one unit of the drawing is at the start.
 */
export interface Glide {
  to: Box;
  dx: number;
  dy: number;
  scale: number;
}

/**
 * The model's box at eased progress `e` (0 at the start, 1 at rest). The glide moves the box's lower left
 * corner on a straight path and scales it about that corner, as the animation in BuildingView does
 * (`translate(dx, dy) scale(s)` to `none`, origin at the lower left).
 */
export function boxAt(g: Glide, e: number): Box {
  const scale = g.scale + (1 - g.scale) * e;
  const left = g.to.left + g.dx * (1 - e);
  const bottom = g.to.bottom + g.dy * (1 - e);
  return { left, bottom, right: left + (g.to.right - g.to.left) * scale, top: bottom - (g.to.bottom - g.to.top) * scale };
}

const touches = (a: Box, b: Box, margin: number) => a.left < b.right + margin && a.right > b.left - margin && a.top < b.bottom + margin && a.bottom > b.top - margin;

/**
 * The share of the glide's duration (0 to 1) from which the model's box stays clear of `place` to the
 * end: 0 when it never touches it, 1 when it still touches it at rest. `margin` is the room kept
 * between the two, in px; `steps` is how finely the glide is sampled.
 */
export function clearFrom(g: Glide, place: Box, ease: (t: number) => number, margin = 2, steps = 120): number {
  for (let i = steps; i >= 0; i -= 1) {
    if (touches(boxAt(g, ease(i / steps)), place, margin)) return Math.min(1, (i + 1) / steps);
  }
  return 0;
}
