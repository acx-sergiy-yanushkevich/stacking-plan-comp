// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors } from '../../domain/derive';
import { isFloorOpen, openFloorOf } from './openFloor';

const floors = deriveFloors(property, TODAY, TODAY);
const f = (id: string) => floors.find((x) => x.floor.id === id)!;

describe('openFloorOf', () => {
  it('has no floor open while nothing is pinned, selected or lit', () => {
    expect(openFloorOf({ floors, highlight: null, selectedFloor: null })).toEqual({ floor: null, pinned: false });
    expect(isFloorOpen({ floors, highlight: null, selectedFloor: null })).toBe(false);
    // A filter that matches nothing opens nothing.
    expect(isFloorOpen({ floors, highlight: new Set(), selectedFloor: null })).toBe(false);
  });

  it('opens the pinned floor (or the floor of the selected suite)', () => {
    const open = openFloorOf({ floors, highlight: null, selectedFloor: f('F8') });
    expect(open.floor?.floor.id).toBe('F8');
    expect(open.pinned).toBe(true);
  });

  it('opens the first floor from the top that a filter lights, as a match and not a pin', () => {
    const lit = new Set([f('F3').segments[0].key, f('F9').segments[0].key]);
    const open = openFloorOf({ floors, highlight: lit, selectedFloor: null });
    expect(open.floor?.floor.id).toBe('F9');
    expect(open.pinned).toBe(false);
  });

  it('keeps the pinned floor when a filter lights another', () => {
    const open = openFloorOf({ floors, highlight: new Set([f('F9').segments[0].key]), selectedFloor: f('F3') });
    expect(open.floor?.floor.id).toBe('F3');
    expect(open.pinned).toBe(true);
  });
});
