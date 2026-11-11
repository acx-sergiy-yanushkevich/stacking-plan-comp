// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors } from '../../domain/derive';
import { legendFor } from '../../domain/lenses';
import { rampNote } from './rampNote';

describe('rampNote', () => {
  it('states which end of the expiration ramp is sooner, in words that hold by night and by day', () => {
    expect(rampNote('expiry', false)).toBe('Steps run from the soonest expiry to the latest.');
  });

  it('says nothing where there is no ramp: the status lens, and the ramps prospect-safe withholds', () => {
    expect(rampNote('status', false)).toBeNull();
    expect(rampNote('expiry', true)).toBeNull();
    expect(rampNote('deals', true)).toBeNull();
  });

  it('explains the rent and the deal ramps the same way', () => {
    expect(rampNote('rent', false)).toBe('Steps run from the lowest gross rent to the highest.');
    // Asking rents stay on the ramp in prospect-safe mode.
    expect(rampNote('rent', true)).toBe('Steps run from the lowest gross rent to the highest.');
    expect(rampNote('deals', false)).toBe('Steps run from the deal furthest along to the earliest.');
  });

  it('goes with a legend that lists the expiration steps soonest first, whatever the theme', () => {
    // The legend is built from the lens alone (no theme goes in), so night and day list the same order.
    const floors = deriveFloors(property, TODAY, TODAY);
    const steps = legendFor('expiry', false, floors).map((i) => i.tone).filter((t) => t.startsWith('exp-'));
    expect(steps).toEqual(['exp-0', 'exp-1', 'exp-2', 'exp-3', 'exp-4', 'exp-5']);
  });
});
