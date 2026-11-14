import { useCallback, useEffect, useRef, useState } from 'react';
import type { ISODate } from '../domain/types';
import { SAFE_TITLE, TITLE } from '../domain/safe';
import { onPopState, readUrl, setTitle, writeUrl } from '../lib/host';
import { openSession, serializeState, stepSession, type PlanSession, type PlanState } from './planState';

/** The fields whose change is a move to somewhere else, not an edit of where the user already is. */
const navigates = (a: PlanState, b: PlanState): boolean =>
  a.view !== b.view || a.building !== b.building || a.floor !== b.floor || a.safe !== b.safe || a.ring !== b.ring || a.turn !== b.turn;

/**
 * One state object for the whole plan, mirrored into the address (`lib/host`: in a browser,
 * `history.replaceState`, or `pushState` for a move to another view, building or floor) so any screen is a shareable link and the back/forward buttons restore it.
 */
export function usePlanState(today: ISODate): [PlanState, (patch: Partial<PlanState>) => void] {
  // The session is the state plus what the Prospect-safe switch withheld. Only the state leaves this hook.
  const [session, setSession] = useState<PlanSession>(() => openSession(readUrl(), today));
  const { state } = session;

  // `stepSession` holds the prospect-safe invariants on every change: turning the mode on drops a search in
  // progress and returns the plan to today, no control can open the worklist, an expiry highlight or another
  // as-of date while it is on, and turning it off puts back what turning it on removed.
  const patch = useCallback(
    (p: Partial<PlanState>) => {
      setSession((prev) => stepSession(prev, p, today));
    },
    [today],
  );

  // Write every change to the address (also normalises an initial address with invalid params). A move to
  // another view, building, floor, ring, turn or the Prospect-safe mode is a history entry, so Back returns to
  // where the user was (round 29: every change replaced the entry and Back left the app); everything else,
  // such as typing a search or choosing a suite, replaces it.
  const last = useRef<PlanState | null>(null);
  useEffect(() => {
    writeUrl(serializeState(state, today), last.current !== null && navigates(last.current, state));
    last.current = state;
  }, [state, today]);

  // Back or Forward to another address is a link opened afresh: nothing withheld is carried into it.
  useEffect(() => onPopState(() => setSession(openSession(readUrl(), today))), [today]);

  return [state, patch];
}

/**
 * The tab reads the product name, not the building's (review, Nov 13), and must never leak the mode:
 * prospect-safe gets its own title.
 */
export function useDocumentTitle(safe: boolean): void {
  useEffect(() => {
    setTitle(safe ? SAFE_TITLE : TITLE);
  }, [safe]);
}
