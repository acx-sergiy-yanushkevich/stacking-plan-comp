import { describe, expect, it } from 'vitest';
import { createSignal } from './signal';

describe('signal', () => {
  it('tells every listener and says how many heard', () => {
    const signal = createSignal<number>();
    expect(signal.emit(1)).toBe(0);
    const got: string[] = [];
    signal.on((n) => got.push(`a${n}`));
    signal.on((n) => got.push(`b${n}`));
    expect(signal.emit(2)).toBe(2);
    expect(got).toEqual(['a2', 'b2']);
  });

  it('stops telling a listener that has stopped listening', () => {
    const signal = createSignal();
    let calls = 0;
    const stop = signal.on(() => calls++);
    signal.emit();
    stop();
    signal.emit();
    expect(calls).toBe(1);
  });

  it('still tells the next listener when one stops while it is being told', () => {
    const signal = createSignal();
    const got: string[] = [];
    const stop = signal.on(() => {
      got.push('first');
      stop();
    });
    signal.on(() => got.push('second'));
    signal.emit();
    expect(got).toEqual(['first', 'second']);
  });
});
