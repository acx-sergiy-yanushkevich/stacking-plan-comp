import { describe, expect, it } from 'vitest';
import { leaveStep } from './useLeaving';

describe('leaveStep', () => {
  it('starts a leave when something open is closed', () => {
    expect(leaveStep(true, false, false, false)).toBe(true);
  });
  it('never leaves under reduced motion: what is closed is gone at once', () => {
    expect(leaveStep(true, false, false, true)).toBe(false);
  });
  it('ends the leave when it is opened again', () => {
    expect(leaveStep(false, true, true, false)).toBe(false);
  });
  it('keeps a leave under way, and starts none for what was never open', () => {
    expect(leaveStep(false, false, true, false)).toBe(true);
    expect(leaveStep(false, false, false, false)).toBe(false);
  });
});
