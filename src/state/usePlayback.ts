import { useCallback, useEffect, useRef, useState } from 'react';
import { playNext, playStart } from '../domain/playback';
import type { ISODate } from '../domain/types';
import { PLAY_STEP_MS } from '../lib/motion';

/** Play through time, as the as-of control sees it. */
export interface Playback {
  /** The date is stepping forward by itself. */
  playing: boolean;
  /**
   * Reduced motion: nothing moves by itself, so the control steps one quarter for each press instead
   * (`playing` is then never true).
   */
  stepOnly: boolean;
  /** Start, pause, or (step only) take one step. */
  toggle: () => void;
}

/**
 * Drives "Play through time" (domain/playback.ts): while playing, the as-of date moves one step every
 * `PLAY_STEP_MS` through `onChange`, the way any control moves it, so the address and every view follow.
 *
 * It stops by itself at the end, when it may no longer run (`enabled`: prospect-safe fixes the date to
 * today), and when anything else moves the date: a preset, the date field, the timeline's cursor, Back. The
 * person's own change always wins over the play.
 *
 * Whether it is playing is not in the address: a link opens a date, never a film of one.
 */
export function usePlayback(asOf: ISODate, today: ISODate, enabled: boolean, stepOnly: boolean, onChange: (d: ISODate) => void): Playback {
  const [playing, setPlaying] = useState(false);
  /** The date the play last asked for. Any other date on the plan was set by someone else. */
  const asked = useRef<ISODate | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    if (!playing) return;
    const next = enabled && !stepOnly && asOf === asked.current ? playNext(asOf, today) : null;
    if (!next) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => {
      asked.current = next;
      change.current(next);
    }, PLAY_STEP_MS);
    return () => clearTimeout(t);
  }, [playing, asOf, today, enabled, stepOnly]);

  const toggle = useCallback(() => {
    if (!enabled) return;
    if (playing) {
      setPlaying(false);
      return;
    }
    const start = playStart(asOf, today);
    if (stepOnly) {
      const next = playNext(start, today);
      if (next) change.current(next);
      return;
    }
    asked.current = start;
    if (start !== asOf) change.current(start);
    setPlaying(true);
  }, [enabled, playing, stepOnly, asOf, today]);

  return { playing: playing && enabled && !stepOnly, stepOnly, toggle };
}
