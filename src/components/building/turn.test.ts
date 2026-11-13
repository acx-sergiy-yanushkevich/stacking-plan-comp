import { describe, expect, it } from 'vitest';
import { ALONE_ANGLE, nearestTurn, turnAngle } from './turn';

describe('turning the building model', () => {
  it('stands at its usual corner view, then a quarter further for each turn', () => {
    expect(ALONE_ANGLE).toBe(-34);
    expect(turnAngle(0)).toBe(-34);
    expect(turnAngle(1)).toBe(56);
    expect(turnAngle(3)).toBe(236);
  });

  it('turns the short way: from the last quarter, one more turn is a quarter, not three back', () => {
    expect(nearestTurn(236, -34)).toBe(326);
    expect(nearestTurn(-34, 236)).toBe(-124);
  });

  it('faces front the short way when a floor opens on a turned model', () => {
    expect(nearestTurn(326, 0)).toBe(360);
    expect(nearestTurn(56, 0)).toBe(0);
  });

  it('keeps an angle it is already at', () => {
    expect(nearestTurn(-34, -34)).toBe(-34);
    expect(nearestTurn(326, -34)).toBe(326);
  });
});
