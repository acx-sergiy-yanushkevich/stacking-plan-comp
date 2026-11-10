// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { observeWidth, plateSize } from './usePlateSize';

/** A ResizeObserver that fires when told to, and remembers whether it was disconnected. */
function fakeObserver() {
  const live: Array<{ fire: () => void; observed: unknown[]; disconnected: boolean }> = [];
  class Observer {
    private readonly rec: (typeof live)[number];
    constructor(onResize: () => void) {
      this.rec = { fire: onResize, observed: [], disconnected: false };
      live.push(this.rec);
    }
    observe(el: never) {
      this.rec.observed.push(el);
    }
    disconnect() {
      this.rec.disconnected = true;
    }
  }
  return { Observer, live };
}

describe('observeWidth: what the plate measures', () => {
  it('measures the element as soon as it is given one, then on every resize', () => {
    const el = { width: 870.6, getBoundingClientRect: () => ({ width: el.width }) };
    const seen: number[] = [];
    const { Observer, live } = fakeObserver();
    const stop = observeWidth(el, (w) => seen.push(w), Observer);
    expect(seen).toEqual([870]);
    expect(live[0].observed).toEqual([el]);

    el.width = 712;
    live[0].fire();
    expect(seen).toEqual([870, 712]);

    stop();
    expect(live[0].disconnected).toBe(true);
  });

  it('a plate that leaves and comes back is measured again by a new observer', () => {
    const { Observer, live } = fakeObserver();
    const seen: number[] = [];
    // The Building view: a floor is opened, closed ("Whole building"), then another is opened.
    observeWidth({ getBoundingClientRect: () => ({ width: 939 }) }, (w) => seen.push(w), Observer)();
    observeWidth({ getBoundingClientRect: () => ({ width: 793 }) }, (w) => seen.push(w), Observer);
    expect(seen).toEqual([939, 793]);
    expect(live.map((o) => o.disconnected)).toEqual([true, false]);
  });

  it('measures once where there is no ResizeObserver, and never reports a negative width', () => {
    const seen: number[] = [];
    const stop = observeWidth({ getBoundingClientRect: () => ({ width: -3 }) }, (w) => seen.push(w), undefined);
    expect(seen).toEqual([0]);
    expect(() => stop()).not.toThrow();
  });
});

describe('plateSize', () => {
  it('draws the plate as wide as its column, at the footprint aspect within 4:3 and 3:1', () => {
    expect(plateSize(939, 2.66)).toEqual({ width: 939, height: 353 });
    expect(plateSize(939, 9)).toEqual({ width: 939, height: 313 });
    expect(plateSize(939, 1)).toEqual({ width: 939, height: 520 });
  });
  it('never draws under 480 px wide or 300 px tall', () => {
    expect(plateSize(200, 2.66)).toEqual({ width: 480, height: 300 });
  });
});
